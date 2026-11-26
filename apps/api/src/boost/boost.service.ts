import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBoostDto } from "./dto/create-boost.dto";
import { BoostCible, BoostStatus, NotificationType } from "@eleganz/database";
import { NotificationsService } from "../notifications/notifications.service";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";
import { enregistrerAuditLog } from "../audit/audit-log.util";

// Délai de règlement d'une facture de boost (26 nov. 2026) — plus court que
// les 7 jours d'un complément d'abonnement Gestion : un boost est un achat
// ponctuel et discrétionnaire, pas un engagement récurrent, donc pas de
// raison de laisser la boutique dans l'incertitude longtemps.
const DELAI_REGLEMENT_BOOST_JOURS = 3;

/**
 * Boost payant (26 nov. 2026, demande propriétaire) — une boutique paie
 * pour mettre en avant toute sa boutique OU un article précis, pour une
 * durée choisie (voir le modèle Boost dans schema.prisma pour le détail des
 * champs et la convention statut/dates).
 *
 * Réutilise le modèle Invoice existant (kind = "boost") : le règlement
 * reste virement/Mobile Money hors ligne, confirmé par un admin qui marque
 * la facture payée (BillingController.markPaid, voir le hook d'activation
 * ci-dessous) — aucune passerelle de paiement réelle n'existe ailleurs dans
 * l'app à ce jour.
 */
@Injectable()
export class BoostService {
  private readonly logger = new Logger(BoostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async idsAdmins(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [...ROLES_ADMIN] } },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  private async destinatairesBoutique(shopId: string): Promise<string[]> {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { ownerId: true, staff: { where: { active: true }, select: { userId: true } } },
    });
    return [shop.ownerId, ...shop.staff.map((s) => s.userId)];
  }

  mesBoosts(shopId: string) {
    return this.prisma.boost.findMany({
      where: { shopId },
      include: {
        tarif: true,
        product: { select: { id: true, name: true, images: true } },
        invoice: { select: { id: true, status: true, dueAt: true, paidAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Achat (26 nov. 2026) — crée dans une seule transaction la facture
   * (kind="boost", PENDING) et le boost lui-même (EN_ATTENTE_PAIEMENT),
   * exactement comme BillingService.changerBouquetGestion crée son
   * complément d'abonnement. N'active RIEN immédiatement : contrairement au
   * changement de bouquet Gestion, un boost n'a aucune urgence d'usage et
   * accorder une mise en avant avant tout règlement irait à l'encontre du
   * principe déjà appliqué partout ailleurs dans l'app ("limiter le risque"
   * — inscription Livreur fermée, modération anti-blanchiment...).
   */
  async acheter(shopId: string, userId: string, dto: CreateBoostDto) {
    const tarif = await this.prisma.boostTarif.findUniqueOrThrow({ where: { id: dto.tarifId } });
    if (!tarif.actif) {
      throw new BadRequestException("Ce forfait n'est plus proposé à l'achat.");
    }
    if (tarif.cible !== dto.cible) {
      throw new BadRequestException("Ce forfait ne correspond pas à la cible choisie.");
    }

    if (dto.cible === BoostCible.PRODUIT) {
      if (!dto.productId) {
        throw new BadRequestException("Choisissez un article à mettre en avant.");
      }
      const produit = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { shopId: true, isPublished: true },
      });
      if (!produit || produit.shopId !== shopId) {
        throw new BadRequestException("Cet article n'appartient pas à cette boutique.");
      }
      if (!produit.isPublished) {
        throw new BadRequestException("Seul un article publié sur ELEGANZ peut être boosté.");
      }
    }

    const maintenant = new Date();
    const dueAt = new Date(maintenant.getTime() + DELAI_REGLEMENT_BOOST_JOURS * 24 * 60 * 60 * 1000);

    const invoice = await this.prisma.invoice.create({
      data: { shopId, amount: tarif.prix, dueAt, status: "PENDING", kind: "boost" },
    });

    const boost = await this.prisma.boost.create({
      data: {
        shopId,
        cible: dto.cible,
        productId: dto.cible === BoostCible.PRODUIT ? dto.productId : null,
        tarifId: tarif.id,
        dureeJours: tarif.dureeJours,
        montant: tarif.prix,
        status: BoostStatus.EN_ATTENTE_PAIEMENT,
        invoiceId: invoice.id,
        requestedByUserId: userId,
      },
      include: {
        tarif: true,
        product: { select: { id: true, name: true, images: true } },
        invoice: true,
      },
    });

    await this.notifications
      .notifierMulticanal(await this.idsAdmins(), {
        type: NotificationType.BOOST_ACHETE,
        title: "Nouveau boost en attente de règlement",
        body: `Une boutique a démarré un boost de ${Number(tarif.prix).toFixed(2)} (${tarif.dureeJours} j) — facture en attente de paiement.`,
        link: "/admin/factures?kind=boost",
      })
      .catch((err) => this.logger.error("Échec de la notification admin BOOST_ACHETE", err));

    await enregistrerAuditLog(this.prisma, {
      actorId: userId,
      shopId,
      action: "BOOST_ACHETE",
      details: { boostId: boost.id, cible: dto.cible, productId: dto.productId ?? null, montant: Number(tarif.prix) },
    });

    return boost;
  }

  async annuler(shopId: string, boostId: string) {
    const boost = await this.prisma.boost.findUniqueOrThrow({ where: { id: boostId } });
    if (boost.shopId !== shopId) {
      throw new BadRequestException("Ce boost n'appartient pas à cette boutique.");
    }
    if (boost.status !== BoostStatus.EN_ATTENTE_PAIEMENT) {
      throw new BadRequestException("Seul un boost pas encore payé peut être annulé.");
    }
    const [boostAnnule] = await this.prisma.$transaction([
      this.prisma.boost.update({ where: { id: boostId }, data: { status: BoostStatus.ANNULE } }),
      // "WAIVED" (déjà utilisé ailleurs pour une facture abandonnée) plutôt
      // que de la laisser PENDING : jamais traitée comme un impayé par les
      // relances/suspensions, qui ne regardent que les factures PENDING.
      this.prisma.invoice.update({ where: { id: boost.invoiceId }, data: { status: "WAIVED" } }),
    ]);
    return boostAnnule;
  }

  /**
   * Activation — appelée par BillingController juste après qu'un admin a
   * marqué la facture liée comme payée (markInvoicePaidAndReactivate).
   * Idempotente : ne fait rien si déjà ACTIF (au cas où l'admin cliquerait
   * deux fois, ou si la facture n'est pas une facture de boost).
   */
  async activerDepuisFacture(invoiceId: string) {
    const boost = await this.prisma.boost.findUnique({ where: { invoiceId } });
    if (!boost || boost.status === BoostStatus.ACTIF) return boost;

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + boost.dureeJours * 24 * 60 * 60 * 1000);
    const boostActive = await this.prisma.boost.update({
      where: { id: boost.id },
      data: { status: BoostStatus.ACTIF, startsAt, endsAt },
    });

    const destinataires = await this.destinatairesBoutique(boost.shopId).catch(() => [] as string[]);
    await this.notifications
      .notifierMulticanal(destinataires, {
        type: NotificationType.BOOST_ACTIVE,
        title: "Boost actif",
        body: `Votre boost est actif jusqu'au ${endsAt.toLocaleDateString("fr-FR")}.`,
        link: "/boost",
      })
      .catch((err) => this.logger.error("Échec de la notification boutique BOOST_ACTIVE", err));

    return boostActive;
  }

  /**
   * Expiration — appelée quotidiennement par CronJobsService (voir
   * cron-jobs.service.ts), et déclenchable manuellement comme les autres
   * étapes du cycle de facturation (POST admin/boost/expirer-maintenant).
   * Ne change QUE `status`, pour l'historique affiché : le tri du catalogue
   * ne se fie jamais à ce champ seul, toujours à `endsAt` comparé à
   * l'instant présent au moment de la requête (voir
   * MarketplaceCatalogService.search).
   */
  async expirerBoostsTermines() {
    const resultat = await this.prisma.boost.updateMany({
      where: { status: BoostStatus.ACTIF, endsAt: { lt: new Date() } },
      data: { status: BoostStatus.EXPIRE },
    });
    if (resultat.count > 0) {
      this.logger.log(`${resultat.count} boost(s) expiré(s).`);
    }
    return { expires: resultat.count };
  }

  // --- Vue admin (Centre de pilotage) ---

  /**
   * Visibilité opérationnelle pour l'admin, au-delà du simple suivi de
   * revenu déjà assuré par admin/factures?kind=boost — qu'est-ce qui est
   * RÉELLEMENT boosté en ce moment, toutes boutiques confondues.
   */
  listerBoostsEnCours() {
    return this.prisma.boost.findMany({
      where: { status: { in: [BoostStatus.EN_ATTENTE_PAIEMENT, BoostStatus.ACTIF] } },
      include: {
        shop: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        tarif: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Révocation admin (modération) — par ex. un boost acheté sur un article
   * ensuite signalé. Repasse à ANNULE et vide `endsAt` immédiatement : pas
   * besoin d'attendre le prochain passage du cron pour que le tri du
   * catalogue cesse de le prendre en compte.
   */
  async revoquer(boostId: string, adminUserId: string) {
    const boost = await this.prisma.boost.update({
      where: { id: boostId },
      data: { status: BoostStatus.ANNULE, endsAt: null },
    });
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      shopId: boost.shopId,
      action: "BOOST_REVOQUE",
      details: { boostId },
    });
    return boost;
  }
}
