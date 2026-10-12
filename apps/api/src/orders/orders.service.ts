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
    return this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { status: newStatus } });
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
    return this.prisma.shopOrder.update({
      where: { id: shopOrderId },
      data: { status: OrderStatus.RECEIVED_CONFIRMED },
    });
  }
}
