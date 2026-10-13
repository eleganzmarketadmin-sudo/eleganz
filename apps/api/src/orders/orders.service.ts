import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderStatus, StockMovementType } from "@eleganz/database";

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Commande multivendeurs (prompt §48) : une seule commande client,
   * découpée en sous-commandes par boutique, chaque vendeur ne voyant que la
   * sienne. Le stock est décompté dans la même transaction pour empêcher
   * qu'une vente en caisse concurrente ne vende le même article.
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
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
            create: [...byShop.entries()].map(([shopId, items]) => ({
              shopId,
              subtotal: items.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
              lines: { create: items },
            })),
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
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({ where: { id: shopOrderId } });
    const allowed = ALLOWED_TRANSITIONS[shopOrder.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Transition ${shopOrder.status} → ${newStatus} non autorisée.`);
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { status: newStatus } }),
      this.prisma.orderStatusEvent.create({ data: { shopOrderId, status: newStatus } }),
    ]);
    return updated;
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
    return updated;
  }
}
