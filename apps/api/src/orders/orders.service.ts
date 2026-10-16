import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { NotificationType, OrderStatus, StockMovementType } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";
import { NotificationsService } from "../notifications/notifications.service";

// Transitions légales du statut d'une sous-commande (prompt §42). Toute
// transition hors de cette carte est refusée — évite qu'un statut saute une
// étape (ex. CREATED -> DELIVERED_DECLARED directement).
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  PAYMENT_PENDING: [OrderStatus.PAYMENT_CONFIRMED, OrderStatus.CANCELLED],
  PAYMENT_CONFIRMED: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY_FOR_PICKUP],
  READY_FOR_PICKUP: [OrderStatus.PICKED_UP],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.DELIVERED_DECLARED],
  // RECEIVED_CONFIRMED est un événement distinct, déclenché par l'acheteur
  // (confirmReceipt ci-dessous), jamais par cette carte de transitions staff.
  DELIVERED_DECLARED: [OrderStatus.DISPUTED],
  RECEIVED_CONFIRMED: [OrderStatus.CLOSED, OrderStatus.RETURN_REQUESTED],
  RETURN_REQUESTED: [OrderStatus.REFUNDED, OrderStatus.DISPUTED],
  DISPUTED: [OrderStatus.REFUNDED, OrderStatus.RECEIVED_CONFIRMED],
  CLOSED: [],
  CANCELLED: [],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Commande multivendeurs (prompt §48) : une seule commande client,
   * découpée en sous-commandes par boutique, chaque vendeur ne voyant que la
   * sienne. Le stock est décompté dans la même transaction pour empêcher
   * qu'une vente en caisse concurrente ne vende le même article.
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      const byShop = new Map<string, { variantId: string; quantity: number; unitPrice: number }[]>();

      for (const item of dto.items) {
        const variant = await tx.variant.findUniqueOrThrow({
          where: { id: item.variantId },
          include: { product: true },
        });

        if (!variant.product.isPublished) {
          throw new BadRequestException(`Le produit ${variant.product.name} n'est pas publié.`);
        }
        if (variant.stockQty < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${variant.sku} : ${variant.stockQty} disponible(s).`,
          );
        }

        await tx.variant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            shopId: variant.product.shopId,
            variantId: item.variantId,
            type: StockMovementType.ONLINE_SALE_RESERVED,
            quantity: -item.quantity,
          },
        });

        const shopItems = byShop.get(variant.product.shopId) ?? [];
        shopItems.push({ variantId: item.variantId, quantity: item.quantity, unitPrice: Number(variant.sellPrice) });
        byShop.set(variant.product.shopId, shopItems);
      }

      const totalAmount = [...byShop.values()]
        .flat()
        .reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

      // Commission ELEGANZ Market (14 oct. 2026, plan commercial) : taux du
      // bouquet Marketplace de la boutique, sinon le taux par défaut de la
      // plateforme, sinon 0 — jamais une valeur inventée. Calculée une fois
      // ici (pas recalculée a posteriori) pour que le taux facturé soit celui
      // en vigueur au moment de la vente, même si l'admin le change ensuite —
      // même principe que le taux de change (docs/PROJECT_STATUS.md).
      const shopIds = [...byShop.keys()];
      const [shopsAvecBouquet, platformSettings] = await Promise.all([
        tx.shop.findMany({
          where: { id: { in: shopIds } },
          select: { id: true, marketplaceBouquet: { select: { commissionRate: true } } },
        }),
        tx.platformSettings.findUnique({
          where: { id: "platform" },
          select: { marketplaceCommissionRateDefault: true },
        }),
      ]);
      const tauxParBoutique = new Map(
        shopsAvecBouquet.map((s) => [
          s.id,
          Number(s.marketplaceBouquet?.commissionRate ?? platformSettings?.marketplaceCommissionRateDefault ?? 0),
        ]),
      );

      const order = await tx.order.create({
        data: {
          buyerId,
          totalAmount,
          buyerWhatsapp: dto.buyerWhatsapp,
          buyerPhone: dto.buyerPhone,
          deliveryCommune: dto.deliveryCommune,
          deliveryQuartier: dto.deliveryQuartier,
          deliveryAvenue: dto.deliveryAvenue,
          deliveryRepere: dto.deliveryRepere,
          deliveryNote: dto.deliveryNote,
          shopOrders: {
            create: [...byShop.entries()].map(([shopId, items]) => {
              const subtotal = items.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
              const taux = tauxParBoutique.get(shopId) ?? 0;
              return {
                shopId,
                subtotal,
                commissionAmount: Math.round(subtotal * (taux / 100) * 100) / 100,
                lines: { create: items },
              };
            }),
          },
        },
        include: { shopOrders: { include: { lines: true } } },
      });

      // Point de départ de l'historique de statut (demande du 12 oct. 2026,
      // point 4) — sans cet événement CREATED, le délai d'acceptation d'une
      // boutique ne pourrait jamais être calculé pour cette commande.
      await tx.orderStatusEvent.createMany({
        data: order.shopOrders.map((so) => ({ shopOrderId: so.id, status: OrderStatus.CREATED })),
      });

      return order;
    });

    // Notification "commande reçue" (demande UX du 15 oct. 2026, point 7) —
    // chaque boutique concernée par la commande (son propriétaire + son
    // équipe active) est notifiée, sans bloquer la réponse à l'acheteur si
    // la notification échoue.
    this.notifierBoutiquesCommandeRecue(order.shopOrders.map((so) => so.shopId)).catch((err) => {
      this.logger.error(`Notification "commande reçue" échouée pour la commande ${order.id}`, err);
    });

    return order;
  }

  private async notifierBoutiquesCommandeRecue(shopIds: string[]) {
    const uniqueShopIds = [...new Set(shopIds)];
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: uniqueShopIds } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        staff: { where: { active: true }, select: { userId: true } },
      },
    });
    for (const shop of shops) {
      const destinataires = [shop.ownerId, ...shop.staff.map((s) => s.userId)];
      await this.notifications.notifierUtilisateurs(destinataires, {
        type: NotificationType.COMMANDE_RECUE,
        title: "Nouvelle commande reçue",
        body: `${shop.name} a reçu une nouvelle commande.`,
        link: "/commandes",
      });
    }
  }

  listForBuyer(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        shopOrders: {
          include: {
            lines: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
            // L'acheteur voit seulement à qui sa commande est confiée pour
            // la livraison (prompt du 13 oct. 2026, point 3) — aucune autre
            // information sur le livreur (téléphone, véhicule...).
            driver: { select: { user: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listForShop(shopId: string) {
    return this.prisma.shopOrder.findMany({
      where: { shopId },
      include: {
        lines: { include: { variant: { include: { product: { select: { name: true } } } } } },
        // Le vendeur garde la main sur l'affectation et doit voir qui est
        // affecté pour pouvoir en changer (prompt du 13 oct. 2026, point 1).
        driver: { select: { id: true, user: { select: { fullName: true } } } },
        // Livreur propre à la boutique (13 oct. 2026, remplace le réseau
        // plateforme pour les nouvelles affectations) — voir ShopDriver.
        shopDriver: { select: { id: true, fullName: true, phone: true } },
        order: {
          select: {
            id: true,
            buyerId: true,
            createdAt: true,
            buyer: { select: { fullName: true, phone: true } },
            buyerWhatsapp: true,
            buyerPhone: true,
            deliveryCommune: true,
            deliveryQuartier: true,
            deliveryAvenue: true,
            deliveryRepere: true,
            deliveryNote: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async transitionStatus(shopOrderId: string, newStatus: OrderStatus) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { lines: true },
    });
    const allowed = ALLOWED_TRANSITIONS[shopOrder.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Transition ${shopOrder.status} → ${newStatus} non autorisée.`);
    }

    const operations = [
      this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { status: newStatus } }),
      this.prisma.orderStatusEvent.create({ data: { shopOrderId, status: newStatus } }),
    ];

    // Annulation (demande du 16 oct. 2026, point 4) — le stock avait été
    // décompté dès la création de la commande (ONLINE_SALE_RESERVED), qu'elle
    // soit annulée par la boutique ou par l'acheteur ; sans restitution ici,
    // l'article resterait indisponible à la vente alors qu'aucune commande
    // réelle ne le retient plus.
    if (newStatus === OrderStatus.CANCELLED) {
      for (const line of shopOrder.lines) {
        operations.push(
          this.prisma.variant.update({
            where: { id: line.variantId },
            data: { stockQty: { increment: line.quantity } },
          }),
        );
        operations.push(
          this.prisma.stockMovement.create({
            data: {
              shopId: shopOrder.shopId,
              variantId: line.variantId,
              type: StockMovementType.RETURN_IN,
              quantity: line.quantity,
            },
          }),
        );
      }
    }

    const [updated] = await this.prisma.$transaction(operations);
    return updated;
  }

  /**
   * Annulation côté acheteur (demande du 16 oct. 2026, point 4) — jusqu'ici
   * seule la boutique pouvait annuler depuis Gestion ; l'acheteur n'avait
   * aucun moyen d'annuler sa propre commande. Mêmes règles de transition que
   * côté boutique (ALLOWED_TRANSITIONS), donc impossible une fois la
   * préparation commencée (PREPARING et au-delà) — à ce stade, seule la
   * boutique peut encore agir.
   */
  async cancelByBuyer(shopOrderId: string, buyerId: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { order: true },
    });
    if (shopOrder.order.buyerId !== buyerId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    return this.transitionStatus(shopOrderId, OrderStatus.CANCELLED);
  }

  /**
   * Confirmation de réception par l'acheteur — un événement distinct de la
   * déclaration de livraison par le livreur (prompt §46). L'absence de
   * réponse ne doit jamais devenir automatiquement une preuve de réception :
   * ce endpoint n'est JAMAIS appelé automatiquement, seulement par l'acheteur.
   */
  async confirmReceipt(shopOrderId: string, buyerId: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { order: true },
    });
    if (shopOrder.order.buyerId !== buyerId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    if (shopOrder.status !== OrderStatus.DELIVERED_DECLARED) {
      throw new BadRequestException("Cette commande n'a pas encore été déclarée livrée par le livreur.");
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.shopOrder.update({
        where: { id: shopOrderId },
        data: { status: OrderStatus.RECEIVED_CONFIRMED },
      }),
      this.prisma.orderStatusEvent.create({
        data: { shopOrderId, status: OrderStatus.RECEIVED_CONFIRMED },
      }),
    ]);

    // Comptabilisée une seule fois, à la réception confirmée (voir
    // docs/ARCHITECTURE_FINANCE.md §8bis.3) — gardée par l'unicité
    // [scope, shopId, sourceType, sourceId] côté AccountingService, donc un
    // retour en arrière puis une nouvelle confirmation ne duplique rien.
    await this.accounting.postShopOrderReceived(updated, shopOrder.order.currency).catch((err) => {
      this.logger.error(`Comptabilisation de la commande ${shopOrderId} échouée`, err);
    });

    return updated;
  }
}
