import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus, PlanCategory, Prisma, ShopStatus, NotificationType } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";
import { calculerPenaliteRetard, joursEntiersEntre, palierCible, SeuilsFacturation, TITRE_PALIER } from "./dunning.util";
import { StorageService } from "../storage/storage.service";
import { enregistrerAuditLog } from "../audit/audit-log.util";

// Durée d'un cycle d'abonnement Gestion quand aucun cycle n'est encore
// suivi pour la boutique (ShopSubscription jamais encore créée pour elle) —
// voir changerBouquetGestion ci-dessous.
const DUREE_CYCLE_GESTION_JOURS = 30;

// Frais d'ouverture appliqué à une boutique sans bouquet Gestion rattaché —
// ne devrait plus jamais arriver en pratique depuis que
// SubscriptionPlansService rattache automatiquement toute boutique au
// bouquet "Pro" par défaut (voir son onModuleInit), mais gardé comme filet
// de sécurité plutôt que de faire planter la facturation.
const FRAIS_OUVERTURE_SECOURS = 100;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // --- Relances/pénalités/réactivation (16 nov. 2026, chantier relances/
  // recouvrement) — helpers partagés par les méthodes ci-dessous. Voir
  // dunning.util.ts pour la formule de pénalité et le calcul du palier
  // cible, partagés avec DriverBillingService/ComptableBillingService.

  private async reglagesFacturation(): Promise<SeuilsFacturation> {
    const settings = await this.prisma.platformSettings.findUniqueOrThrow({ where: { id: "platform" } });
    return {
      invoiceLatePenaltyRatePercent: settings.invoiceLatePenaltyRatePercent,
      invoicePenaltyGraceDays: settings.invoicePenaltyGraceDays,
      reminderDay1Offset: settings.reminderDay1Offset,
      reminderDay2Offset: settings.reminderDay2Offset,
      reminderDay3Offset: settings.reminderDay3Offset,
      warningDayOffset: settings.warningDayOffset,
      suspensionDayOffset: settings.suspensionDayOffset,
    };
  }

  private async idsAdmins(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({ where: { role: { in: [...ROLES_ADMIN] } }, select: { id: true } });
    return admins.map((a) => a.id);
  }

  private async destinatairesBoutique(shopId: string): Promise<string[]> {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { ownerId: true, staff: { where: { active: true }, select: { userId: true } } },
    });
    return [shop.ownerId, ...shop.staff.map((s) => s.userId)];
  }

  private messagePourPalier(palier: number, montant: number, reglages: SeuilsFacturation): string {
    const m = montant.toFixed(2);
    switch (palier) {
      case 1:
        return `Votre facture ELEGANZ de ${m} arrive à échéance aujourd'hui. Merci de la régler depuis Facturation.`;
      case 2:
        return `Rappel : votre facture ELEGANZ de ${m} est en retard de paiement. Merci de la régler rapidement.`;
      case 3:
        return `3e relance : votre facture ELEGANZ de ${m} reste impayée. Au-delà de ${reglages.warningDayOffset} jours de retard, un avertissement de suspension sera émis.`;
      case 4:
        return `Avertissement : votre facture ELEGANZ de ${m} est impayée depuis plus de ${reglages.warningDayOffset} jours. Passé ${reglages.suspensionDayOffset} jours de retard, l'accès sera suspendu si elle reste impayée.`;
      case 5:
        return `L'accès a été suspendu pour facture impayée depuis plus de ${reglages.suspensionDayOffset} jours. Réglez vos factures en attente depuis Facturation pour qu'une demande de réactivation s'ouvre.`;
      default:
        return "";
    }
  }

  private async appliquerEtapeRelance(
    facture: { id: string; amount: Prisma.Decimal; shopId: string; shop: { ownerId: string; staff: { userId: string }[] } },
    palier: number,
    reglages: SeuilsFacturation,
    opts: { manuel: boolean; adminUserId?: string },
  ) {
    const message = this.messagePourPalier(palier, Number(facture.amount), reglages);
    await this.prisma.invoice.update({
      where: { id: facture.id },
      data: { reminderStage: palier, lastReminderSentAt: new Date() },
    });

    const destinataires = [facture.shop.ownerId, ...facture.shop.staff.map((s) => s.userId)];
    // Correctif du 19 nov. 2026 (audit de bout en bout) : `canaux` restait
    // vide jusqu'ici (jamais renseigné à la création), alors que le plan le
    // prévoyait explicitement pour diagnostiquer après coup un échec
    // d'envoi SMS/WhatsApp — notifierMulticanal renvoie maintenant la liste
    // des canaux réellement actifs pour cet envoi.
    const canaux = await this.notifications.notifierMulticanal(destinataires, {
      type: palier === 5 ? NotificationType.FACTURE_SUSPENDUE : NotificationType.FACTURE_RELANCE,
      title: TITRE_PALIER[palier] ?? "Relance de facturation",
      body: message,
      link: "/parametres",
    });
    await this.prisma.invoiceReminder.create({
      data: {
        invoiceId: facture.id,
        stage: palier,
        message,
        canaux,
        sentByUserId: opts.manuel ? opts.adminUserId ?? null : null,
      },
    });
  }

  /**
   * Remplace l'ancienne `suspendOverdueShops` ET l'ancienne
   * `EcheancierService.relancerFacturesBoutiques` pour les factures
   * boutiques spécifiquement (16 nov. 2026, chantier relances/
   * recouvrement) : calcule, pour chaque facture PENDING, le palier cible
   * (`palierCible`) à partir des seuils configurés dans PlatformSettings,
   * et ne ré-agit que si ce palier dépasse celui déjà atteint
   * (`reminderStage`) — c'est ce qui évite qu'une relance soit renvoyée
   * chaque jour une fois un palier atteint, contrairement au comportement
   * précédent. À la bascule du palier 5, suspend la boutique et notifie en
   * plus les admins (jamais seulement la boutique, pour que l'équipe sache
   * qu'une suspension automatique vient d'avoir lieu).
   */
  async executerEscaladeFacturesBoutiques(maintenant = new Date()) {
    const reglages = await this.reglagesFacturation();
    const factures = await this.prisma.invoice.findMany({
      where: { status: "PENDING" },
      include: {
        shop: {
          select: { id: true, name: true, status: true, ownerId: true, staff: { where: { active: true }, select: { userId: true } } },
        },
      },
    });

    const resultats = { relancesEnvoyees: 0, boutiquesSuspendues: 0 };
    const shopIdsASuspendre = new Set<string>();

    for (const facture of factures) {
      const jours = joursEntiersEntre(facture.dueAt, maintenant);
      const palier = palierCible(jours, reglages);
      if (palier <= facture.reminderStage) continue;

      await this.appliquerEtapeRelance(facture, palier, reglages, { manuel: false });
      resultats.relancesEnvoyees += 1;

      if (palier === 5 && facture.shop.status !== ShopStatus.SUSPENDED) {
        shopIdsASuspendre.add(facture.shopId);
      }
    }

    for (const shopId of shopIdsASuspendre) {
      await this.prisma.shop.update({
        where: { id: shopId },
        data: { status: ShopStatus.SUSPENDED, suspendedAt: maintenant, suspensionReason: "IMPAYE" },
      });
      await this.notifications.notifierMulticanal(await this.idsAdmins(), {
        type: NotificationType.FACTURE_SUSPENDUE,
        title: "Boutique suspendue pour impayé",
        body: `Une boutique a été suspendue automatiquement (facture impayée depuis plus de ${reglages.suspensionDayOffset} jours).`,
        link: "/admin/factures",
      });
      resultats.boutiquesSuspendues += 1;
    }
    return resultats;
  }

  /**
   * Relance manuelle groupée depuis l'écran admin Factures (bouton
   * "Envoyer une relance" avec sélection multiple) — contrairement à
   * l'escalade automatique ci-dessus, peut renvoyer le palier déjà atteint
   * à la demande (ne force pas d'attendre un nouveau seuil franchi), pour
   * que l'admin puisse relancer "à la demande" une boutique précise.
   * Chaque envoi manuel trace `sentByUserId` pour le distinguer d'un envoi
   * automatique dans l'historique (InvoiceReminder).
   */
  async envoyerRelancesManuelles(invoiceIds: string[], adminUserId: string) {
    const reglages = await this.reglagesFacturation();
    const resultats: { invoiceId: string; action: string }[] = [];
    for (const invoiceId of invoiceIds) {
      const facture = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { shop: { select: { ownerId: true, staff: { where: { active: true }, select: { userId: true } } } } },
      });
      if (!facture || facture.status !== "PENDING") {
        resultats.push({ invoiceId, action: "ignoree_non_en_attente" });
        continue;
      }
      const jours = joursEntiersEntre(facture.dueAt, new Date());
      const palier = Math.max(palierCible(jours, reglages), facture.reminderStage || 1);
      await this.appliquerEtapeRelance(facture, palier, reglages, { manuel: true, adminUserId });
      resultats.push({ invoiceId, action: "relance_envoyee" });
    }
    return resultats;
  }

  /**
   * Fait passer les boutiques dont la période gratuite est écoulée de
   * FREE_PERIOD à PAYMENT_DUE et génère la facture correspondante
   * (décision #3 : durée configurable par boutique, décompte à partir de
   * `freeTrialStartedAt`, jamais depuis une date fixe globale).
   *
   * Le montant de la facture d'ouverture vient désormais du bouquet Gestion
   * choisi par la boutique (`SubscriptionPlan.openingFee`, 14 oct. 2026,
   * plan commercial) au lieu d'être fixe pour toutes — voir
   * FRAIS_OUVERTURE_SECOURS pour le filet de sécurité si aucun bouquet
   * n'est rattaché.
   *
   * TODO : brancher sur un planificateur réel (ex. @nestjs/schedule + cron
   * quotidien) une fois en production — pour l'instant déclenché manuellement
   * par un administrateur via POST /admin/billing/run-trial-check.
   */
  async processTrialExpirations() {
    const now = new Date();
    const candidates = await this.prisma.shop.findMany({
      where: { status: ShopStatus.FREE_PERIOD, openingFeeWaived: true },
      include: { gestionBouquet: { select: { openingFee: true } } },
    });

    const results: { shopId: string; action: string }[] = [];

    for (const shop of candidates) {
      if (!shop.freeTrialStartedAt) continue;
      const trialEndsAt = new Date(shop.freeTrialStartedAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + shop.freeTrialDurationDays);

      if (now >= trialEndsAt) {
        const montant = shop.gestionBouquet?.openingFee ?? FRAIS_OUVERTURE_SECOURS;
        await this.prisma.$transaction([
          this.prisma.shop.update({
            where: { id: shop.id },
            data: { status: ShopStatus.PAYMENT_DUE, openingFeeWaived: false },
          }),
          this.prisma.invoice.create({
            data: {
              shopId: shop.id,
              amount: montant,
              dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              kind: "opening_fee",
            },
          }),
        ]);
        results.push({ shopId: shop.id, action: "moved_to_payment_due" });
      }
    }

    return results;
  }

  /**
   * Facture mensuelle pour les boutiques déjà ACTIVE, au tarif de leur
   * bouquet Gestion (`SubscriptionPlan.monthlyPrice`) — jusqu'ici, aucune
   * facture récurrente n'était générée pour une boutique une fois le frais
   * d'ouverture payé (contrairement aux livreurs et à Secourable, qui
   * ont chacun leur cycle mensuel depuis le départ). Déclenchement manuel,
   * comme le reste du cycle de facturation sur ce projet — voir
   * POST /admin/billing/run-monthly-billing.
   */
  async runMonthlyBilling() {
    const now = new Date();
    const boutiquesActives = await this.prisma.shop.findMany({
      where: { status: ShopStatus.ACTIVE },
      include: { gestionBouquet: { select: { monthlyPrice: true } } },
    });

    const results: { shopId: string; action: string }[] = [];
    for (const shop of boutiquesActives) {
      if (!shop.gestionBouquet) {
        results.push({ shopId: shop.id, action: "skipped_no_bouquet" });
        continue;
      }
      await this.prisma.invoice.create({
        data: {
          shopId: shop.id,
          amount: shop.gestionBouquet.monthlyPrice,
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          kind: "subscription",
        },
      });
      results.push({ shopId: shop.id, action: "invoice_created" });
    }
    return results;
  }

  /**
   * Facture de commission ELEGANZ Market (14 oct. 2026, plan commercial) —
   * agrège, boutique par boutique, la commission des sous-commandes
   * complètement terminées (`CLOSED`, c'est-à-dire reçues et confirmées par
   * l'acheteur, jamais une commande encore en cours ou litigieuse) pas
   * encore facturées (`commissionInvoicedAt IS NULL`), génère une facture
   * `kind: "commission"` si le total est positif, puis marque ces
   * sous-commandes comme facturées pour ne jamais les compter deux fois.
   * Déclenchement manuel, comme le reste du cycle de facturation du projet.
   */
  async runCommissionBilling() {
    const now = new Date();
    const sousCommandesAFacturer = await this.prisma.shopOrder.findMany({
      where: { status: OrderStatus.CLOSED, commissionInvoicedAt: null, commissionAmount: { gt: 0 } },
      select: { id: true, shopId: true, commissionAmount: true },
    });

    const parBoutique = new Map<string, { ids: string[]; total: number }>();
    for (const so of sousCommandesAFacturer) {
      const entree = parBoutique.get(so.shopId) ?? { ids: [], total: 0 };
      entree.ids.push(so.id);
      entree.total += Number(so.commissionAmount);
      parBoutique.set(so.shopId, entree);
    }

    const results: { shopId: string; action: string }[] = [];
    for (const [shopId, { ids, total }] of parBoutique) {
      await this.prisma.$transaction([
        this.prisma.invoice.create({
          data: {
            shopId,
            amount: Math.round(total * 100) / 100,
            dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            kind: "commission",
          },
        }),
        this.prisma.shopOrder.updateMany({
          where: { id: { in: ids } },
          data: { commissionInvoicedAt: now },
        }),
      ]);
      results.push({ shopId, action: "invoice_created" });
    }
    return results;
  }

  /**
   * Réactivation après paiement confirmé. Une boutique suspendue conserve
   * tout son historique (prompt §31) — la réactivation ne fait que changer
   * le statut et solder la facture.
   *
   * Réécrite le 16 nov. 2026 (chantier relances/recouvrement) :
   * - fige `penaltyDays`/`penaltyAmount` via `calculerPenaliteRetard`
   *   (jamais recalculée après coup — voir dunning.util.ts) ;
   * - correctif du 18 oct. 2026 conservé : ne repasse ACTIVE que si plus
   *   aucune facture PENDING ne reste pour cette boutique ;
   * - NOUVEAU : si la boutique est déjà SUSPENDED, le paiement ne la
   *   réactive plus JAMAIS automatiquement, même si tout est soldé — seule
   *   `validerReactivation` (validation admin explicite) le fait. À la
   *   place, dès que le solde tombe à zéro pour une boutique suspendue, une
   *   `ShopReactivationRequest` s'ouvre automatiquement (décision du
   *   propriétaire : réactivation automatique côté demande, mais toujours
   *   soumise à validation admin) ;
   * - envoie systématiquement un reçu de confirmation au propriétaire/
   *   staff actif, quel que soit le canal configuré (notifierMulticanal).
   */
  async markInvoicePaidAndReactivate(invoiceId: string, markedByUserId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { shop: true } });
    const reglages = await this.reglagesFacturation();
    const paidAt = new Date();
    const { penaltyDays, penaltyAmount } = calculerPenaliteRetard(invoice.amount, invoice.dueAt, paidAt, reglages);

    const autresFacturesImpayees = await this.prisma.invoice.count({
      where: { shopId: invoice.shopId, status: "PENDING", id: { not: invoiceId } },
    });
    const toutSolde = autresFacturesImpayees === 0;
    const dejaSuspendue = invoice.shop.status === ShopStatus.SUSPENDED;
    // Correctif du 19 nov. 2026 : une boutique déjà CLOSED (fermeture en
    // libre-service, ShopsService.fermerBoutique) peut tout de même recevoir
    // une facture de commission a posteriori (runCommissionBilling ne filtre
    // pas par statut boutique — des ShopOrder déjà closes avant la fermeture
    // peuvent rester à facturer). Sans ce garde, solder cette seule facture
    // repassait silencieusement la boutique à ACTIVE (toutSolde vrai,
    // dejaSuspendue faux) — une boutique fermée par son propriétaire ne doit
    // jamais rouvrir d'elle-même. Même principe que dejaSuspendue ci-dessus :
    // on préserve l'état « non actif » existant plutôt que de le recalculer.
    const dejaFermee = invoice.shop.status === ShopStatus.CLOSED;
    const nouveauStatutBoutique = dejaSuspendue
      ? ShopStatus.SUSPENDED
      : dejaFermee
        ? ShopStatus.CLOSED
        : toutSolde
          ? ShopStatus.ACTIVE
          : ShopStatus.PAYMENT_DUE;

    const [factureMaj] = await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt, penaltyDays, penaltyAmount } }),
      this.prisma.shop.update({ where: { id: invoice.shopId }, data: { status: nouveauStatutBoutique } }),
    ]);

    // Revenu ELEGANZ reconnu au règlement effectif, jamais à la facturation
    // (docs/ARCHITECTURE_FINANCE.md §8bis.3) — inclut la pénalité, qui est
    // elle aussi un encaissement réel au moment du paiement.
    await this.accounting
      .postPlatformInvoicePaid({ id: factureMaj.id, amount: Number(invoice.amount) + penaltyAmount }, "invoice")
      .catch((err) => {
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la facture ${invoiceId} échouée`, err);
      });

    const destinataires = await this.destinatairesBoutique(invoice.shopId).catch(() => [] as string[]);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.PAIEMENT_RECU,
      title: "Reçu de paiement ELEGANZ",
      body:
        penaltyAmount > 0
          ? `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue (pénalité de retard : ${penaltyAmount.toFixed(2)} sur ${penaltyDays} jour(s)). Merci.`
          : `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue. Merci.`,
      link: "/parametres",
    });

    let demandeReactivation = null;
    if (dejaSuspendue && toutSolde) {
      const dejaEnAttente = await this.prisma.shopReactivationRequest.findFirst({
        where: { shopId: invoice.shopId, status: "PENDING" },
      });
      demandeReactivation = dejaEnAttente ?? (await this.prisma.shopReactivationRequest.create({ data: { shopId: invoice.shopId } }));
      if (!dejaEnAttente) {
        await this.notifications.notifierMulticanal(await this.idsAdmins(), {
          type: NotificationType.REACTIVATION_DEMANDE,
          title: "Demande de réactivation",
          body: `${invoice.shop.name} a réglé toutes ses factures — demande de réactivation en attente de validation.`,
          link: "/admin/factures",
        });
      }
    }

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: markedByUserId,
      shopId: invoice.shopId,
      action: "FACTURE_MARQUEE_PAYEE",
      details: { invoiceId, penaltyDays, penaltyAmount, reactivee: nouveauStatutBoutique === ShopStatus.ACTIVE },
    });

    return {
      ...factureMaj,
      facturesRestantes: autresFacturesImpayees,
      reactivee: nouveauStatutBoutique === ShopStatus.ACTIVE,
      penaltyDays,
      penaltyAmount,
      demandeReactivation,
    };
  }

  /**
   * Validation admin d'une demande de réactivation (16 nov. 2026) — jamais
   * automatique : même si `markInvoicePaidAndReactivate` a ouvert la
   * demande dès solde à zéro, c'est cette méthode, déclenchée depuis
   * l'écran admin Factures, qui fait réellement repasser la boutique
   * ACTIVE. Revérifie le sine qua non (aucune facture PENDING) même si déjà
   * vrai à l'ouverture de la demande, au cas où une nouvelle facture serait
   * apparue entre-temps.
   */
  async validerReactivation(requestId: string, decision: "APPROVE" | "REJECT", adminUserId: string, note?: string) {
    const demande = await this.prisma.shopReactivationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { shop: true },
    });
    if (demande.status !== "PENDING") {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    if (decision === "APPROVE") {
      const impayees = await this.prisma.invoice.count({ where: { shopId: demande.shopId, status: "PENDING" } });
      if (impayees > 0) {
        throw new BadRequestException(`${impayees} facture(s) encore impayée(s) — la réactivation ne peut pas être validée.`);
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.shopReactivationRequest.update({
        where: { id: requestId },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          reviewNote: note,
        },
      }),
    ];
    if (decision === "APPROVE") {
      operations.push(
        this.prisma.shop.update({
          where: { id: demande.shopId },
          data: { status: ShopStatus.ACTIVE, suspendedAt: null, suspensionReason: null },
        }),
      );
    }
    const [demandeMaj] = await this.prisma.$transaction(operations);

    const destinataires = await this.destinatairesBoutique(demande.shopId);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.REACTIVATION_DEMANDE,
      title: decision === "APPROVE" ? "Réactivation validée" : "Demande de réactivation refusée",
      body:
        decision === "APPROVE"
          ? "Votre boutique a été réactivée."
          : `Votre demande de réactivation a été refusée.${note ? ` Motif : ${note}` : ""}`,
      link: "/parametres",
    });

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      shopId: demande.shopId,
      action: "REACTIVATION_DECISION",
      details: { requestId, decision, note: note?.trim() || null },
    });

    return demandeMaj;
  }

  listReactivationRequests(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
    return this.prisma.shopReactivationRequest.findMany({
      where: { status },
      include: { shop: { select: { id: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  /**
   * État de l'abonnement Gestion d'une boutique, pour l'écran libre-service
   * "Abonnement" de Gestion (16 oct. 2026, point 1 des propositions du 16
   * oct. 2026) — jamais le bouquet Marketplace, volontairement laissé de
   * côté à ce stade (voir changerBouquetGestion). `cycle` vaut `null` tant
   * qu'aucun changement de bouquet n'est encore passé par
   * changerBouquetGestion pour cette boutique (ShopSubscription jamais
   * encore créée) : ce n'est pas une anomalie, juste l'état de départ.
   */
  async getStatutAbonnementGestion(shopId: string) {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: { gestionBouquet: true },
    });

    const abonnementActuel = await this.prisma.shopSubscription.findFirst({
      where: { shopId, plan: { category: PlanCategory.GESTION } },
      orderBy: { startedAt: "desc" },
    });

    const catalogue = await this.prisma.subscriptionPlan.findMany({
      where: { category: PlanCategory.GESTION, active: true },
      orderBy: { monthlyPrice: "asc" },
    });

    return {
      planActuel: shop.gestionBouquet,
      cycle: abonnementActuel
        ? { debut: abonnementActuel.startedAt, renouvellement: abonnementActuel.renewsAt, statut: abonnementActuel.status }
        : null,
      catalogue,
    };
  }

  /**
   * Changement de bouquet Gestion en libre-service, déclenché par le
   * propriétaire de la boutique à tout moment (16 oct. 2026, demande du
   * propriétaire ELEGANZ) — jamais le bouquet Marketplace, qui reste un
   * changement réservé à l'administration (ShopsService.adminSetPlan,
   * /admin/boutiques) à ce stade.
   *
   * Calcule un complément au prorata du temps restant dans le cycle en
   * cours plutôt que de facturer (ou créditer) un mois plein à chaque
   * changement :
   *   - jours restants = date de renouvellement − aujourd'hui (bornés à
   *     [0, durée du cycle])
   *   - avoir sur l'ancien bouquet = ancien prix mensuel × (jours restants
   *     ÷ durée du cycle)
   *   - dû sur le nouveau bouquet = nouveau prix mensuel × (jours restants
   *     ÷ durée du cycle)
   *   - complément = dû nouveau bouquet − avoir ancien bouquet
   *
   * Aucun `ShopSubscription` n'existe encore dans ce projet avant le tout
   * premier appel à cette méthode pour une boutique donnée (le modèle
   * existait en base mais n'était lu/écrit nulle part) : ce premier appel
   * démarre un cycle de `DUREE_CYCLE_GESTION_JOURS` jours à partir
   * d'aujourd'hui, donc avec jours restants = durée du cycle (fraction = 1)
   * — le tout premier changement facture ou crédite l'écart de prix complet,
   * ce qui est le comportement attendu en l'absence de tout cycle déjà en
   * cours. La date de renouvellement n'est JAMAIS réinitialisée par un
   * changement de bouquet : seul le prix facturé pour le reste du cycle
   * change, le rythme de facturation reste le même.
   *
   * Un complément positif (montée en gamme) crée une facture `PENDING`
   * classique. Un complément négatif (descente en gamme) crée un avoir déjà
   * `PAID` (rien n'est jamais remboursé en espèces ni viré automatiquement —
   * voir le principe déjà appliqué ailleurs sur la plateforme) : il reste
   * visible dans l'historique de facturation de la boutique
   * (`GET /shops/:shopId/invoices`), mais n'est pas encore déduit
   * automatiquement d'une facture future — cette consolidation n'existe pas
   * encore dans `runMonthlyBilling`, à construire séparément si besoin.
   */
  async changerBouquetGestion(shopId: string, nouveauPlanId: string) {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: { gestionBouquet: true },
    });

    const nouveauPlan = await this.prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: nouveauPlanId } });
    if (nouveauPlan.category !== PlanCategory.GESTION) {
      throw new BadRequestException("Ce bouquet n'est pas un bouquet Gestion.");
    }
    if (!nouveauPlan.active) {
      throw new BadRequestException("Ce bouquet n'est plus proposé à la souscription.");
    }
    if (shop.gestionBouquetId === nouveauPlanId) {
      throw new ConflictException("La boutique est déjà sur ce bouquet.");
    }

    const ancienPlan = shop.gestionBouquet;
    const maintenant = new Date();

    const abonnementActuel = await this.prisma.shopSubscription.findFirst({
      where: { shopId, plan: { category: PlanCategory.GESTION } },
      orderBy: { startedAt: "desc" },
    });

    let finCycle: Date;
    let dureeCycleJours: number;
    if (abonnementActuel?.renewsAt && abonnementActuel.renewsAt > maintenant) {
      finCycle = abonnementActuel.renewsAt;
      dureeCycleJours = Math.max(
        1,
        Math.round((finCycle.getTime() - abonnementActuel.startedAt.getTime()) / (24 * 60 * 60 * 1000)),
      );
    } else {
      finCycle = new Date(maintenant.getTime() + DUREE_CYCLE_GESTION_JOURS * 24 * 60 * 60 * 1000);
      dureeCycleJours = DUREE_CYCLE_GESTION_JOURS;
    }

    const joursRestants = Math.min(
      dureeCycleJours,
      Math.max(0, Math.round((finCycle.getTime() - maintenant.getTime()) / (24 * 60 * 60 * 1000))),
    );
    const fraction = joursRestants / dureeCycleJours;

    const ancienPrix = ancienPlan ? Number(ancienPlan.monthlyPrice) : 0;
    const nouveauPrix = Number(nouveauPlan.monthlyPrice);
    const avoirAncien = Math.round(ancienPrix * fraction * 100) / 100;
    const duNouveau = Math.round(nouveauPrix * fraction * 100) / 100;
    const complement = Math.round((duNouveau - avoirAncien) * 100) / 100;

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.shop.update({ where: { id: shopId }, data: { gestionBouquetId: nouveauPlanId } }),
      this.prisma.shopSubscription.create({
        data: { shopId, planId: nouveauPlanId, startedAt: maintenant, renewsAt: finCycle, status: "ACTIVE" },
      }),
    ];
    let indexFacture = -1;
    if (complement !== 0) {
      indexFacture = operations.length;
      operations.push(
        this.prisma.invoice.create({
          data: {
            shopId,
            amount: Math.abs(complement),
            dueAt: complement > 0 ? new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000) : maintenant,
            status: complement > 0 ? "PENDING" : "PAID",
            paidAt: complement > 0 ? null : maintenant,
            kind: complement > 0 ? "subscription_complement" : "subscription_credit",
          },
        }),
      );
    }

    const resultats = await this.prisma.$transaction(operations);

    return {
      ancienPlan: ancienPlan ? { id: ancienPlan.id, name: ancienPlan.name, monthlyPrice: ancienPlan.monthlyPrice } : null,
      nouveauPlan: { id: nouveauPlan.id, name: nouveauPlan.name, monthlyPrice: nouveauPlan.monthlyPrice },
      joursRestants,
      dureeCycleJours,
      complement,
      facture: indexFacture >= 0 ? resultats[indexFacture] : null,
      renouvellement: finCycle,
    };
  }

  listInvoices(shopId: string) {
    return this.prisma.invoice.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
  }

  // --- Preuves de paiement (16 nov. 2026, chantier relances/recouvrement,
  // point "en cas d'erreur/omission") — upload direct vers R2 via URL
  // signée, même mécanisme que StorageService.creerUrlUpload déjà utilisé
  // pour les documents Experts/le logo de facturation. Jamais de passage
  // par la messagerie (Conversation/Message n'a aucun champ de pièce
  // jointe aujourd'hui) : un modèle dédié, plus simple, qui s'affiche
  // directement et de façon compacte sur la ligne de facture admin.

  creerUrlUploadPreuvePaiement(shopId: string, invoiceId: string, contentType: string) {
    return this.storage.creerUrlUpload(`shops/${shopId}/invoices/${invoiceId}/proofs`, contentType);
  }

  async soumettrePreuvePaiement(shopId: string, invoiceId: string, userId: string, fileUrl: string, note?: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (invoice.shopId !== shopId) {
      throw new BadRequestException("Cette facture n'appartient pas à cette boutique.");
    }
    // Même garde-fou SSRF que le reste de la plateforme (12 nov. 2026,
    // retour client) : on ne fait jamais confiance à une URL fournie par
    // un client sans vérifier qu'elle pointe vers notre propre bucket.
    if (!this.storage.urlEstDansLeBucket(fileUrl)) {
      throw new BadRequestException("Le fichier déposé n'a pas été uploadé via le lien fourni par cette page.");
    }
    const preuve = await this.prisma.invoicePaymentProof.create({
      data: { invoiceId, submittedByUserId: userId, fileUrl, note },
    });
    await this.notifications.notifierMulticanal(await this.idsAdmins(), {
      type: NotificationType.FACTURE_RELANCE,
      title: "Preuve de paiement déposée",
      body: `Une boutique a déposé une preuve de paiement pour une facture de ${Number(invoice.amount).toFixed(2)}.`,
      link: "/admin/factures",
    });
    return preuve;
  }

  listPaymentProofs(invoiceId: string) {
    return this.prisma.invoicePaymentProof.findMany({ where: { invoiceId }, orderBy: { submittedAt: "desc" } });
  }

  listReminders(invoiceId: string) {
    return this.prisma.invoiceReminder.findMany({ where: { invoiceId }, orderBy: { sentAt: "desc" } });
  }

  /**
   * Vue admin transversale : toutes les factures, toutes boutiques
   * confondues, avec le nom de la boutique — nécessaire pour un suivi
   * financier sans avoir à ouvrir chaque boutique une par une.
   */
  listAllInvoices() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { id: true, name: true } } },
    });
  }
}
