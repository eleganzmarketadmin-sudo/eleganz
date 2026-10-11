import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un litige peut être ouvert par l'acheteur (produit non reçu, colis
   * endommagé, ...) ou par le vendeur (prompt §47). On accepte ici un
   * initiateur générique ; le rôle exact est vérifié par les contrôleurs
   * (buyer via ownership de la commande, vendeur via ShopMembershipGuard).
   */
  async open(shopOrderId: string, reason: string) {
    await this.prisma.shopOrder.update({
      where: { id: shopOrderId },
      data: { status: "DISPUTED" },
    });
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
   * TODO : brancher sur un guard ADMIN_* dédié une fois le Centre de
   * pilotage développé — pour l'instant vérifié inline dans le contrôleur.
   */
  async resolve(disputeId: string, resolution: string) {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: "RESOLVED", resolution },
    });
  }
}
