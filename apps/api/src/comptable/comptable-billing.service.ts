import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ComptableBillingStatus, NotificationType, Prisma } from "@eleganz/database";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { AccountingService } from "../finance/accounting.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";
import { calculerPenaliteRetard, joursEntiersEntre, palierCible, SeuilsFacturation, TITRE_PALIER } from "../billing/dunning.util";
import { StorageService } from "../storage/storage.service";
import { enregistrerAuditLog } from "../audit/audit-log.util";

/**
 * Facturation d'ELEGANZ Secourable (prompt du 13 oct. 2026, §14) — même
 * découpage que DriverBillingService/BillingService. Chaque méthode reste
 * déclenchable manuellement depuis les écrans admin (POST /admin/.../run-...)
 * ET tourne automatiquement chaque jour à 3h via CronJobsService (corrigé le
 * 12 nov. 2026 — ce commentaire affirmait encore à tort qu'aucun
 * planificateur n'était branché). `freeTrialStartedAt` est posé dès la
 * création de l'abonnement (= première activation effective), jamais à la
 * création du compte ELEGANZ.
 *
 * Relances numérotées/pénalités/réactivation (16 nov. 2026, chantier
 * relances/recouvrement, généralisé aux trois domaines) : même motif que
 * BillingService — voir ses commentaires pour le détail, non répétés ici.
 */
@Injectable()
export class ComptableBillingService {
  private readonly logger = new Logger(ComptableBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // --- Relances/pénalités/réactivation — voir BillingService (boutiques)
  // pour la justification détaillée de chaque helper.

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

  private async destinataireAbonne(subscriptionId: string): Promise<string[]> {
    const sub = await this.prisma.comptableSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      select: { userId: true },
    });
    return [sub.userId];
  }

  private messagePourPalier(palier: number, montant: number, reglages: SeuilsFacturation): string {
    const m = montant.toFixed(2);
    switch (palier) {
      case 1:
        return `Votre facture ELEGANZ Mon Comptable de ${m} arrive à échéance aujourd'hui. Merci de la régler.`;
      case 2:
        return `Rappel : votre facture ELEGANZ Mon Comptable de ${m} est en retard de paiement. Merci de la régler rapidement.`;
      case 3:
        return `3e relance : votre facture Mon Comptable de ${m} reste impayée. Au-delà de ${reglages.warningDayOffset} jours de retard, un avertissement de suspension sera émis.`;
      case 4:
        return `Avertissement : votre facture Mon Comptable de ${m} est impayée depuis plus de ${reglages.warningDayOffset} jours. Passé ${reglages.suspensionDayOffset} jours de retard, l'accès sera suspendu si elle reste impayée.`;
      case 5:
        return `L'accès à Mon Comptable a été suspendu pour facture impayée depuis plus de ${reglages.suspensionDayOffset} jours. Réglez vos factures en attente pour qu'une demande de réactivation s'ouvre.`;
      default:
        return "";
    }
  }

  private async appliquerEtapeRelance(
    facture: { id: string; amount: Prisma.Decimal; subscriptionId: string; subscription: { userId: string } },
    palier: number,
    reglages: SeuilsFacturation,
    opts: { manuel: boolean; adminUserId?: string },
  ) {
    const message = this.messagePourPalier(palier, Number(facture.amount), reglages);
    await this.prisma.comptableInvoice.update({
      where: { id: facture.id },
      data: { reminderStage: palier, lastReminderSentAt: new Date() },
    });

    // Correctif du 19 nov. 2026 (audit de bout en bout) — voir
    // BillingService.appliquerEtapeRelance pour la justification complète :
    // `canaux` restait vide jusqu'ici.
    const canaux = await this.notifications.notifierMulticanal([facture.subscription.userId], {
      type: palier === 5 ? NotificationType.FACTURE_SUSPENDUE : NotificationType.FACTURE_RELANCE,
      title: TITRE_PALIER[palier] ?? "Relance de facturation",
      body: message,
      link: "/comptable",
    });
    await this.prisma.comptableInvoiceReminder.create({
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
   * Remplace l'ancienne `suspendOverdueSubscriptions` ET l'ancienne
   * `EcheancierService.relancerFacturesComptable` (16 nov. 2026, chantier
   * relances/recouvrement) — voir BillingService.executerEscaladeFacturesBoutiques,
   * motif identique appliqué aux factures Mon Comptable/Secourable.
   */
  async executerEscaladeFacturesComptable(maintenant = new Date()) {
    const reglages = await this.reglagesFacturation();
    const factures = await this.prisma.comptableInvoice.findMany({
      where: { status: "PENDING" },
      include: { subscription: { select: { id: true, userId: true, billingStatus: true } } },
    });

    const resultats = { relancesEnvoyees: 0, abonnesSuspendus: 0 };
    const subscriptionIdsASuspendre = new Set<string>();

    for (const facture of factures) {
      const jours = joursEntiersEntre(facture.dueAt, maintenant);
      const palier = palierCible(jours, reglages);
      if (palier <= facture.reminderStage) continue;

      await this.appliquerEtapeRelance(facture, palier, reglages, { manuel: false });
      resultats.relancesEnvoyees += 1;

      if (palier === 5 && facture.subscription.billingStatus !== ComptableBillingStatus.SUSPENDED) {
        subscriptionIdsASuspendre.add(facture.subscriptionId);
      }
    }

    for (const subscriptionId of subscriptionIdsASuspendre) {
      await this.prisma.comptableSubscription.update({
        where: { id: subscriptionId },
        data: { billingStatus: ComptableBillingStatus.SUSPENDED, suspendedAt: maintenant, suspensionReason: "IMPAYE" },
      });
      await this.notifications.notifierMulticanal(await this.idsAdmins(), {
        type: NotificationType.FACTURE_SUSPENDUE,
        title: "Abonnement Mon Comptable suspendu pour impayé",
        body: `Un abonnement Mon Comptable a été suspendu automatiquement (facture impayée depuis plus de ${reglages.suspensionDayOffset} jours).`,
        link: "/admin/factures",
      });
      resultats.abonnesSuspendus += 1;
    }
    return resultats;
  }

  /** Relance manuelle groupée — voir BillingService.envoyerRelancesManuelles. */
  async envoyerRelancesManuelles(invoiceIds: string[], adminUserId: string) {
    const reglages = await this.reglagesFacturation();
    const resultats: { invoiceId: string; action: string }[] = [];
    for (const invoiceId of invoiceIds) {
      const facture = await this.prisma.comptableInvoice.findUnique({
        where: { id: invoiceId },
        include: { subscription: { select: { userId: true } } },
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

  async processTrialExpirations() {
    const settings = await this.adminSettingsService.get();
    const now = new Date();
    const candidates = await this.prisma.comptableSubscription.findMany({
      where: { billingStatus: ComptableBillingStatus.FREE_PERIOD },
      include: { bouquet: true },
    });

    const results: { subscriptionId: string; action: string }[] = [];

    for (const sub of candidates) {
      const trialEndsAt = new Date(sub.freeTrialStartedAt);
      trialEndsAt.setMonth(trialEndsAt.getMonth() + settings.comptableFreeMonths);

      if (now >= trialEndsAt) {
        const plan = sub.plan ?? "MONTHLY";
        // Prix du bouquet (14 oct. 2026, proposition validée) si rattaché,
        // sinon le tarif plat historique en filet de sécurité — même
        // principe que FRAIS_OUVERTURE_SECOURS côté ELEGANZ Gestion.
        const amount =
          plan === "YEARLY"
            ? (sub.bouquet?.yearlyPrice ?? settings.comptableYearlyFee)
            : (sub.bouquet?.monthlyPrice ?? settings.comptableMonthlyFee);
        await this.prisma.$transaction([
          this.prisma.comptableSubscription.update({
            where: { id: sub.id },
            data: { billingStatus: ComptableBillingStatus.PAYMENT_DUE, plan },
          }),
          this.prisma.comptableInvoice.create({
            data: {
              subscriptionId: sub.id,
              amount,
              dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              kind: plan === "YEARLY" ? "yearly" : "monthly",
            },
          }),
        ]);
        results.push({ subscriptionId: sub.id, action: "moved_to_payment_due" });
      }
    }

    return results;
  }

  /** Facture de renouvellement pour les abonnements ACTIVE, selon le plan choisi (mensuel ou annuel). */
  async runRenewalBilling() {
    const settings = await this.adminSettingsService.get();
    const now = new Date();
    const actifs = await this.prisma.comptableSubscription.findMany({
      where: { billingStatus: ComptableBillingStatus.ACTIVE, renewsAt: { lte: now } },
      include: { bouquet: true },
    });

    const results: { subscriptionId: string; action: string }[] = [];
    for (const sub of actifs) {
      const plan = sub.plan ?? "MONTHLY";
      const amount =
        plan === "YEARLY"
          ? (sub.bouquet?.yearlyPrice ?? settings.comptableYearlyFee)
          : (sub.bouquet?.monthlyPrice ?? settings.comptableMonthlyFee);
      await this.prisma.comptableInvoice.create({
        data: {
          subscriptionId: sub.id,
          amount,
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          kind: plan === "YEARLY" ? "yearly" : "monthly",
        },
      });
      results.push({ subscriptionId: sub.id, action: "invoice_created" });
    }
    return results;
  }

  /**
   * Réactivation après paiement confirmé — réécrite le 16 nov. 2026 (même
   * motif que BillingService.markInvoicePaidAndReactivate). Conserve le
   * comportement du 18 oct. 2026 sur `renewsAt` : avancé seulement quand
   * plus aucune facture PENDING ne reste (`toutSolde`), qu'il reste ou non
   * suspendu — c'est la facturation qui avance, pas l'accès. L'accès
   * (billingStatus) ne repasse en revanche plus jamais ACTIVE automatiquement
   * depuis un état déjà SUSPENDED : seule `validerReactivation` le fait.
   */
  async markInvoicePaidAndReactivate(invoiceId: string, markedByUserId: string) {
    const invoice = await this.prisma.comptableInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    const reglages = await this.reglagesFacturation();
    const paidAt = new Date();
    const { penaltyDays, penaltyAmount } = calculerPenaliteRetard(invoice.amount, invoice.dueAt, paidAt, reglages);

    const autresFacturesImpayees = await this.prisma.comptableInvoice.count({
      where: { subscriptionId: invoice.subscriptionId, status: "PENDING", id: { not: invoiceId } },
    });
    const toutSolde = autresFacturesImpayees === 0;
    const dejaSuspendu = invoice.subscription.billingStatus === ComptableBillingStatus.SUSPENDED;
    const nouveauStatut = dejaSuspendu
      ? ComptableBillingStatus.SUSPENDED
      : toutSolde
        ? ComptableBillingStatus.ACTIVE
        : ComptableBillingStatus.PAYMENT_DUE;

    let renewsAt: Date | undefined;
    if (toutSolde) {
      renewsAt = new Date(paidAt);
      renewsAt.setMonth(renewsAt.getMonth() + (invoice.subscription.plan === "YEARLY" ? 12 : 1));
    }

    const [factureMaj] = await this.prisma.$transaction([
      this.prisma.comptableInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt, penaltyDays, penaltyAmount } }),
      this.prisma.comptableSubscription.update({
        where: { id: invoice.subscriptionId },
        data: renewsAt ? { billingStatus: nouveauStatut, renewsAt } : { billingStatus: nouveauStatut },
      }),
    ]);

    await this.accounting
      .postPlatformInvoicePaid({ id: factureMaj.id, amount: Number(invoice.amount) + penaltyAmount }, "comptableInvoice")
      .catch((err) => {
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la facture Secourable ${invoiceId} échouée`, err);
      });

    const destinataires = await this.destinataireAbonne(invoice.subscriptionId).catch(() => [] as string[]);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.PAIEMENT_RECU,
      title: "Reçu de paiement ELEGANZ",
      body:
        penaltyAmount > 0
          ? `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue (pénalité de retard : ${penaltyAmount.toFixed(2)} sur ${penaltyDays} jour(s)). Merci.`
          : `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue. Merci.`,
      link: "/comptable",
    });

    let demandeReactivation = null;
    if (dejaSuspendu && toutSolde) {
      const dejaEnAttente = await this.prisma.comptableReactivationRequest.findFirst({
        where: { subscriptionId: invoice.subscriptionId, status: "PENDING" },
      });
      demandeReactivation =
        dejaEnAttente ??
        (await this.prisma.comptableReactivationRequest.create({ data: { subscriptionId: invoice.subscriptionId } }));
      if (!dejaEnAttente) {
        await this.notifications.notifierMulticanal(await this.idsAdmins(), {
          type: NotificationType.REACTIVATION_DEMANDE,
          title: "Demande de réactivation",
          body: "Un abonné Mon Comptable a réglé toutes ses factures — demande de réactivation en attente de validation.",
          link: "/admin/factures",
        });
      }
    }

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts. Pas de
    // shopId ici (facturation Secourable, jamais une boutique) :
    // l'identifiant de l'abonnement est porté par `details`.
    await enregistrerAuditLog(this.prisma, {
      actorId: markedByUserId,
      action: "FACTURE_MARQUEE_PAYEE",
      details: {
        invoiceId,
        subscriptionId: invoice.subscriptionId,
        penaltyDays,
        penaltyAmount,
        reactivee: nouveauStatut === ComptableBillingStatus.ACTIVE,
      },
    });

    return {
      ...factureMaj,
      facturesRestantes: autresFacturesImpayees,
      reactivee: nouveauStatut === ComptableBillingStatus.ACTIVE,
      penaltyDays,
      penaltyAmount,
      demandeReactivation,
    };
  }

  /** Validation admin d'une demande de réactivation — voir BillingService.validerReactivation. */
  async validerReactivation(requestId: string, decision: "APPROVE" | "REJECT", adminUserId: string, note?: string) {
    const demande = await this.prisma.comptableReactivationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { subscription: true },
    });
    if (demande.status !== "PENDING") {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    if (decision === "APPROVE") {
      const impayees = await this.prisma.comptableInvoice.count({
        where: { subscriptionId: demande.subscriptionId, status: "PENDING" },
      });
      if (impayees > 0) {
        throw new BadRequestException(`${impayees} facture(s) encore impayée(s) — la réactivation ne peut pas être validée.`);
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.comptableReactivationRequest.update({
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
        this.prisma.comptableSubscription.update({
          where: { id: demande.subscriptionId },
          data: { billingStatus: ComptableBillingStatus.ACTIVE, suspendedAt: null, suspensionReason: null },
        }),
      );
    }
    const [demandeMaj] = await this.prisma.$transaction(operations);

    const destinataires = await this.destinataireAbonne(demande.subscriptionId);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.REACTIVATION_DEMANDE,
      title: decision === "APPROVE" ? "Réactivation validée" : "Demande de réactivation refusée",
      body:
        decision === "APPROVE"
          ? "Votre abonnement Mon Comptable a été réactivé."
          : `Votre demande de réactivation a été refusée.${note ? ` Motif : ${note}` : ""}`,
      link: "/comptable",
    });

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      action: "REACTIVATION_DECISION",
      details: { requestId, subscriptionId: demande.subscriptionId, decision, note: note?.trim() || null },
    });

    return demandeMaj;
  }

  listReactivationRequests(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
    return this.prisma.comptableReactivationRequest.findMany({
      where: { status },
      include: { subscription: { select: { id: true, user: { select: { fullName: true } } } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  // --- Preuves de paiement — voir BillingService pour la justification complète.

  creerUrlUploadPreuvePaiement(subscriptionId: string, invoiceId: string, contentType: string) {
    return this.storage.creerUrlUpload(`comptable/${subscriptionId}/invoices/${invoiceId}/proofs`, contentType);
  }

  async soumettrePreuvePaiement(subscriptionId: string, invoiceId: string, userId: string, fileUrl: string, note?: string) {
    const invoice = await this.prisma.comptableInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (invoice.subscriptionId !== subscriptionId) {
      throw new BadRequestException("Cette facture n'appartient pas à cet abonnement.");
    }
    if (!this.storage.urlEstDansLeBucket(fileUrl)) {
      throw new BadRequestException("Le fichier déposé n'a pas été uploadé via le lien fourni par cette page.");
    }
    const preuve = await this.prisma.comptableInvoicePaymentProof.create({
      data: { invoiceId, submittedByUserId: userId, fileUrl, note },
    });
    await this.notifications.notifierMulticanal(await this.idsAdmins(), {
      type: NotificationType.FACTURE_RELANCE,
      title: "Preuve de paiement déposée",
      body: `Un abonné Mon Comptable a déposé une preuve de paiement pour une facture de ${Number(invoice.amount).toFixed(2)}.`,
      link: "/admin/factures",
    });
    return preuve;
  }

  listPaymentProofs(invoiceId: string) {
    return this.prisma.comptableInvoicePaymentProof.findMany({ where: { invoiceId }, orderBy: { submittedAt: "desc" } });
  }

  listReminders(invoiceId: string) {
    return this.prisma.comptableInvoiceReminder.findMany({ where: { invoiceId }, orderBy: { sentAt: "desc" } });
  }

  listInvoices(subscriptionId: string) {
    return this.prisma.comptableInvoice.findMany({ where: { subscriptionId }, orderBy: { createdAt: "desc" } });
  }

  listAllInvoices() {
    return this.prisma.comptableInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { subscription: { select: { id: true, user: { select: { fullName: true } } } } },
    });
  }

  /**
   * Vue agrégée pour le Centre de pilotage (prompt §19) — comptages et
   * revenus seulement, jamais le détail financier privé d'un utilisateur.
   */
  async adminOverview() {
    const [total, parStatut, activites, utilisateursSansSaisieActive] = await Promise.all([
      this.prisma.comptableSubscription.count(),
      this.prisma.comptableSubscription.groupBy({ by: ["billingStatus"], _count: { _all: true } }),
      this.prisma.comptableActivity.count({ where: { archived: false } }),
      this.prisma.comptableSubscription.count({ where: { plan: null } }),
    ]);

    const parPlan = await this.prisma.comptableSubscription.groupBy({
      by: ["plan"],
      _count: { _all: true },
      where: { billingStatus: "ACTIVE" },
    });

    const facturesPayees = await this.prisma.comptableInvoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    });

    const facturesEnAttente = await this.prisma.comptableInvoice.count({ where: { status: "PENDING" } });

    return {
      totalInscrits: total,
      activitesCreees: activites,
      parStatut: Object.fromEntries(parStatut.map((s) => [s.billingStatus, s._count._all])),
      parPlan: Object.fromEntries(parPlan.map((p) => [p.plan ?? "NON_CHOISI", p._count._all])),
      revenusEncaisses: Number(facturesPayees._sum.amount ?? 0),
      facturesEnAttente,
      sansPlanChoisi: utilisateursSansSaisieActive,
    };
  }
}
