import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { OrderStatus } from "@eleganz/database";

export const ISSUES_LITIGE = ["REFUND", "REJECTED"] as const;
export type IssueLitige = (typeof ISSUES_LITIGE)[number];

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Un litige peut être ouvert par l'acheteur (produit non reçu, colis
   * endommagé, ...) ou par le vendeur (prompt §47). On accepte ici un
   * initiateur générique ; le rôle exact est vérifié par les contrôleurs
   * (buyer via ownership de la commande, vendeur via ShopMembershipGuard).
   */
  async open(shopOrderId: string, reason: string) {
    await this.prisma.$transaction([
      this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { status: "DISPUTED" } }),
      this.prisma.orderStatusEvent.create({ data: { shopOrderId, status: "DISPUTED" } }),
    ]);
    return this.prisma.dispute.create({ data: { shopOrderId, reason } });
  }

  async openAsBuyer(shopOrderId: string, buyerId: string, reason: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { order: true },
    });
    if (shopOrder.order.buyerId !== buyerId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    return this.open(shopOrderId, reason);
  }

  /**
   * Ouverture côté boutique (prompt §47, second sens) : par exemple quand
   * l'acheteur refuse de confirmer la réception ou conteste à tort. La
   * véritable autorisation « cette commande concerne bien cette boutique »
   * est déjà assurée par ShopMembershipGuard + l'appartenance de la route
   * `shops/:shopId/...` ; on revérifie ici pour ne jamais dépendre que du
   * contrôleur.
   */
  async openAsShop(shopOrderId: string, shopId: string, reason: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({ where: { id: shopOrderId } });
    if (shopOrder.shopId !== shopId) {
      throw new ForbiddenException("Cette commande n'appartient pas à cette boutique.");
    }
    return this.open(shopOrderId, reason);
  }

  listOpen() {
    return this.prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: { shopOrder: { include: { shop: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Litiges concernant une boutique précise — ce que ShopMembershipGuard
   * autorise déjà à voir, mais filtré pour ne jamais exposer les litiges
   * d'une autre boutique (séparation des données exigée partout ailleurs
   * dans l'API).
   */
  listForShop(shopId: string) {
    return this.prisma.dispute.findMany({
      where: { shopOrder: { shopId } },
      include: { shopOrder: { include: { lines: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Décision administrative (prompt §47 : « l'administration doit pouvoir
   * examiner le dossier, enregistrer une décision et assurer le suivi »).
   *
   * Correctif audit du 16 oct. 2026 : jusqu'ici, resolve() ne faisait
   * avancer QUE Dispute.status — ShopOrder.status restait bloqué sur
   * DISPUTED indéfiniment même une fois le litige tranché, puisque rien
   * n'appelait jamais OrdersService.transitionStatus(..., REFUNDED). Un
   * `outcome` est désormais obligatoire : REFUND fait avancer la commande
   * vers REFUNDED (restitue le stock — voir OrdersService.transitionStatus)
   * ; REJECTED la fait revenir à RECEIVED_CONFIRMED (réception confirmée
   * maintenue, la commande peut suivre son cours normal — retour produit,
   * clôture...). Les deux transitions existent déjà dans
   * ALLOWED_TRANSITIONS[DISPUTED].
   */
  async resolve(disputeId: string, outcome: IssueLitige, resolution: string) {
    const litige = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { shopOrder: { select: { shopId: true } } },
    });
    if (!litige) {
      throw new NotFoundException("Litige introuvable.");
    }
    if (litige.status === "RESOLVED") {
      throw new BadRequestException("Ce litige a déjà été tranché.");
    }

    // `shopId` vient de la sous-commande déjà chargée (jamais de l'appelant)
    // — cette décision est administrative (admin uniquement, voir le
    // contrôleur), donc pas d'IDOR possible ici, seulement la forme exigée
    // par OrdersService.transitionStatus depuis le correctif du 21 oct. 2026.
    await this.orders.transitionStatus(
      litige.shopOrder.shopId,
      litige.shopOrderId,
      outcome === "REFUND" ? OrderStatus.REFUNDED : OrderStatus.RECEIVED_CONFIRMED,
    );

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: "RESOLVED", resolution: `[${outcome}] ${resolution}` },
    });
  }
}
