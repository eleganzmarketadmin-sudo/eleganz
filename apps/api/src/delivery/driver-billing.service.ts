import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DriverBillingStatus, NotificationType, Prisma } from "@eleganz/database";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { AccountingService } from "../finance/accounting.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";
import { calculerPenaliteRetard, joursEntiersEntre, palierCible, SeuilsFacturation, TITRE_PALIER } from "../billing/dunning.util";
import { StorageService } from "../storage/storage.service";

/**
 * Facturation de l'espace livreur (prompt du 13 oct. 2026, point 1) —
 * calquée sur BillingService (boutiques), mais entièrement indépendante :
 * un livreur a son propre statut de facturation (DriverBillingStatus),
 * distinct de `verified` (instruction du dossier identité/véhicule). Les
 * deux verrous bloquent l'affectation de missions, mais séparément : un
 * livreur peut être vérifié et suspendu pour impayé, ou l'inverse.
 *
 * Tarifs et durée de gratuité 100 % paramétrables depuis le Centre de
 * pilotage (PlatformSettings.driverOpeningFee / driverMonthlyFee /
 * driverFreeMonths) — jamais codés en dur ici.
 *
 * Relances numérotées/pénalités/réactivation (16 nov. 2026, chantier
 * relances/recouvrement, généralisé aux trois domaines) : même motif que
 * BillingService — voir ses commentaires pour le détail, non répétés ici.
 */
@Injectable()
export class DriverBillingService {
  private readonly logger = new Logger(DriverBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // --- Relances/pénalités/réactivation — voir BillingService (boutiques)
  // pour la justification détaillée de chaque helper ; dunning.util.ts
  // porte la logique pure partagée.

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

  private async destinataireLivreur(driverId: string): Promise<string[]> {
    const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId }, select: { userId: true } });
    return [driver.userId];
  }

  private messagePourPalier(palier: number, montant: number, reglages: SeuilsFacturation): string {
    const m = montant.toFixed(2);
    switch (palier) {
      case 1:
        return `Votre facture livreur ELEGANZ de ${m} arrive à échéance aujourd'hui. Merci de la régler.`;
      case 2:
        return `Rappel : votre facture livreur ELEGANZ de ${m} est en retard de paiement. Merci de la régler rapidement.`;
      case 3:
        return `3e relance : votre facture livreur de ${m} reste impayée. Au-delà de ${reglages.warningDayOffset} jours de retard, un avertissement de suspension sera émis.`;
      case 4:
        return `Avertissement : votre facture livreur de ${m} est impayée depuis plus de ${reglages.warningDayOffset} jours. Passé ${reglages.suspensionDayOffset} jours de retard, vos missions seront suspendues si elle reste impayée.`;
      case 5:
        return `Vos missions ont été suspendues pour facture impayée depuis plus de ${reglages.suspensionDayOffset} jours. Réglez vos factures en attente pour qu'une demande de réactivation s'ouvre.`;
      default:
        return "";
    }
  }

  private async appliquerEtapeRelance(
    facture: { id: string; amount: Prisma.Decimal; driverId: string; driver: { userId: string } },
    palier: number,
    reglages: SeuilsFacturation,
    opts: { manuel: boolean; adminUserId?: string },
  ) {
    const message = this.messagePourPalier(palier, Number(facture.amount), reglages);
    await this.prisma.driverInvoice.update({
      where: { id: facture.id },
      data: { reminderStage: palier, lastReminderSentAt: new Date() },
    });
    await this.prisma.driverInvoiceReminder.create({
      data: { invoiceId: facture.id, stage: palier, message, sentByUserId: opts.manuel ? opts.adminUserId ?? null : null },
    });

    await this.notifications.notifierMulticanal([facture.driver.userId], {
      type: palier === 5 ? NotificationType.FACTURE_SUSPENDUE : NotificationType.FACTURE_RELANCE,
      title: TITRE_PALIER[palier] ?? "Relance de facturation",
      body: message,
      link: "/livreur/profil",
    });
  }

  /**
   * Remplace l'ancienne `suspendOverdueDrivers` ET l'ancienne
   * `EcheancierService.relancerFacturesLivreurs` (16 nov. 2026, chantier
   * relances/recouvrement) — voir BillingService.executerEscaladeFacturesBoutiques,
   * motif identique appliqué aux factures livreur.
   */
  async executerEscaladeFacturesLivreurs(maintenant = new Date()) {
    const reglages = await this.reglagesFacturation();
    const factures = await this.prisma.driverInvoice.findMany({
      where: { status: "PENDING" },
      include: { driver: { select: { id: true, userId: true, billingStatus: true } } },
    });

    const resultats = { relancesEnvoyees: 0, livreursSuspendus: 0 };
    const driverIdsASuspendre = new Set<string>();

    for (const facture of factures) {
      const jours = joursEntiersEntre(facture.dueAt, maintenant);
      const palier = palierCible(jours, reglages);
      if (palier <= facture.reminderStage) continue;

      await this.appliquerEtapeRelance(facture, palier, reglages, { manuel: false });
      resultats.relancesEnvoyees += 1;

      if (palier === 5 && facture.driver.billingStatus !== DriverBillingStatus.SUSPENDED) {
        driverIdsASuspendre.add(facture.driverId);
      }
    }

    for (const driverId of driverIdsASuspendre) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { billingStatus: DriverBillingStatus.SUSPENDED, suspendedAt: maintenant, suspensionReason: "IMPAYE" },
      });
      await this.notifications.notifierMulticanal(await this.idsAdmins(), {
        type: NotificationType.FACTURE_SUSPENDUE,
        title: "Livreur suspendu pour impayé",
        body: `Un livreur a été suspendu automatiquement (facture impayée depuis plus de ${reglages.suspensionDayOffset} jours).`,
        link: "/admin/factures",
      });
      resultats.livreursSuspendus += 1;
    }
    return resultats;
  }

  /** Relance manuelle groupée — voir BillingService.envoyerRelancesManuelles. */
  async envoyerRelancesManuelles(invoiceIds: string[], adminUserId: string) {
    const reglages = await this.reglagesFacturation();
    const resultats: { invoiceId: string; action: string }[] = [];
    for (const invoiceId of invoiceIds) {
      const facture = await this.prisma.driverInvoice.findUnique({
        where: { id: invoiceId },
        include: { driver: { select: { userId: true } } },
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
   * Démarre la période de gratuité au moment précis où l'admin valide le
   * dossier du livreur (verified: false → true) — jamais à l'inscription.
   * Sans effet si la gratuité a déjà été démarrée (évite de la redémarrer
   * si l'admin retire puis redonne la vérification).
   */
  async startFreeTrialIfNeeded(driverId: string) {
    const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    if (driver.freeTrialStartedAt) return driver;
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { freeTrialStartedAt: new Date(), billingStatus: DriverBillingStatus.FREE_PERIOD },
    });
  }

  /**
   * Fait passer les livreurs dont la gratuité est écoulée de FREE_PERIOD à
   * PAYMENT_DUE et génère la facture d'ouverture (frais de souscription).
   * Déclenchement manuel pour l'instant (voir BillingService, même TODO de
   * planificateur) via POST /admin/driver-billing/run-trial-check.
   */
  async processTrialExpirations() {
    const settings = await this.adminSettingsService.get();
    const now = new Date();
    const candidates = await this.prisma.driver.findMany({
      where: { billingStatus: DriverBillingStatus.FREE_PERIOD },
    });

    const results: { driverId: string; action: string }[] = [];

    for (const driver of candidates) {
      if (!driver.freeTrialStartedAt) continue;
      const trialEndsAt = new Date(driver.freeTrialStartedAt);
      trialEndsAt.setMonth(trialEndsAt.getMonth() + settings.driverFreeMonths);

      if (now >= trialEndsAt) {
        await this.prisma.$transaction([
          this.prisma.driver.update({
            where: { id: driver.id },
            data: { billingStatus: DriverBillingStatus.PAYMENT_DUE },
          }),
          this.prisma.driverInvoice.create({
            data: {
              driverId: driver.id,
              amount: settings.driverOpeningFee,
              dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              kind: "opening_fee",
            },
          }),
        ]);
        results.push({ driverId: driver.id, action: "moved_to_payment_due" });
      }
    }

    return results;
  }

  /**
   * Facture mensuelle pour les livreurs déjà ACTIVE (à jour), afin de
   * générer l'abonnement du mois suivant. Déclenchement manuel, comme le
   * reste du cycle de facturation sur ce projet.
   */
  async runMonthlyBilling() {
    const settings = await this.adminSettingsService.get();
    const now = new Date();
    const activeDrivers = await this.prisma.driver.findMany({
      where: { billingStatus: DriverBillingStatus.ACTIVE },
    });

    const results: { driverId: string; action: string }[] = [];
    for (const driver of activeDrivers) {
      await this.prisma.driverInvoice.create({
        data: {
          driverId: driver.id,
          amount: settings.driverMonthlyFee,
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          kind: "subscription",
        },
      });
      results.push({ driverId: driver.id, action: "invoice_created" });
    }
    return results;
  }

  /**
   * Réactivation après paiement confirmé — réécrite le 16 nov. 2026 (même
   * motif que BillingService.markInvoicePaidAndReactivate) : fige la
   * pénalité, ne réactive plus jamais automatiquement un livreur déjà
   * SUSPENDED (seule `validerReactivation` le fait), ouvre une demande de
   * réactivation automatique dès solde à zéro, envoie un reçu systématique.
   */
  async markInvoicePaidAndReactivate(invoiceId: string, markedByUserId: string) {
    const invoice = await this.prisma.driverInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { driver: true } });
    const reglages = await this.reglagesFacturation();
    const paidAt = new Date();
    const { penaltyDays, penaltyAmount } = calculerPenaliteRetard(invoice.amount, invoice.dueAt, paidAt, reglages);

    const autresFacturesImpayees = await this.prisma.driverInvoice.count({
      where: { driverId: invoice.driverId, status: "PENDING", id: { not: invoiceId } },
    });
    const toutSolde = autresFacturesImpayees === 0;
    const dejaSuspendu = invoice.driver.billingStatus === DriverBillingStatus.SUSPENDED;
    const nouveauStatut = dejaSuspendu
      ? DriverBillingStatus.SUSPENDED
      : toutSolde
        ? DriverBillingStatus.ACTIVE
        : DriverBillingStatus.PAYMENT_DUE;

    const [factureMaj] = await this.prisma.$transaction([
      this.prisma.driverInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt, penaltyDays, penaltyAmount } }),
      this.prisma.driver.update({ where: { id: invoice.driverId }, data: { billingStatus: nouveauStatut } }),
    ]);

    await this.accounting
      .postPlatformInvoicePaid({ id: factureMaj.id, amount: Number(invoice.amount) + penaltyAmount }, "driverInvoice")
      .catch((err) => {
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la facture livreur ${invoiceId} échouée`, err);
      });

    const destinataires = await this.destinataireLivreur(invoice.driverId).catch(() => [] as string[]);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.PAIEMENT_RECU,
      title: "Reçu de paiement ELEGANZ",
      body:
        penaltyAmount > 0
          ? `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue (pénalité de retard : ${penaltyAmount.toFixed(2)} sur ${penaltyDays} jour(s)). Merci.`
          : `Facture ${invoice.kind} de ${Number(invoice.amount).toFixed(2)} reçue. Merci.`,
      link: "/livreur/profil",
    });

    let demandeReactivation = null;
    if (dejaSuspendu && toutSolde) {
      const dejaEnAttente = await this.prisma.driverReactivationRequest.findFirst({
        where: { driverId: invoice.driverId, status: "PENDING" },
      });
      demandeReactivation =
        dejaEnAttente ?? (await this.prisma.driverReactivationRequest.create({ data: { driverId: invoice.driverId } }));
      if (!dejaEnAttente) {
        await this.notifications.notifierMulticanal(await this.idsAdmins(), {
          type: NotificationType.REACTIVATION_DEMANDE,
          title: "Demande de réactivation",
          body: "Un livreur a réglé toutes ses factures — demande de réactivation en attente de validation.",
          link: "/admin/factures",
        });
      }
    }

    return {
      ...factureMaj,
      facturesRestantes: autresFacturesImpayees,
      reactivee: nouveauStatut === DriverBillingStatus.ACTIVE,
      penaltyDays,
      penaltyAmount,
      demandeReactivation,
    };
  }

  /** Validation admin d'une demande de réactivation — voir BillingService.validerReactivation. */
  async validerReactivation(requestId: string, decision: "APPROVE" | "REJECT", adminUserId: string, note?: string) {
    const demande = await this.prisma.driverReactivationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { driver: true },
    });
    if (demande.status !== "PENDING") {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    if (decision === "APPROVE") {
      const impayees = await this.prisma.driverInvoice.count({ where: { driverId: demande.driverId, status: "PENDING" } });
      if (impayees > 0) {
        throw new BadRequestException(`${impayees} facture(s) encore impayée(s) — la réactivation ne peut pas être validée.`);
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.driverReactivationRequest.update({
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
        this.prisma.driver.update({
          where: { id: demande.driverId },
          data: { billingStatus: DriverBillingStatus.ACTIVE, suspendedAt: null, suspensionReason: null },
        }),
      );
    }
    const [demandeMaj] = await this.prisma.$transaction(operations);

    const destinataires = await this.destinataireLivreur(demande.driverId);
    await this.notifications.notifierMulticanal(destinataires, {
      type: NotificationType.REACTIVATION_DEMANDE,
      title: decision === "APPROVE" ? "Réactivation validée" : "Demande de réactivation refusée",
      body:
        decision === "APPROVE"
          ? "Votre compte livreur a été réactivé."
          : `Votre demande de réactivation a été refusée.${note ? ` Motif : ${note}` : ""}`,
      link: "/livreur/profil",
    });

    return demandeMaj;
  }

  listReactivationRequests(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
    return this.prisma.driverReactivationRequest.findMany({
      where: { status },
      include: { driver: { select: { id: true, user: { select: { fullName: true } } } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  // --- Preuves de paiement — voir BillingService pour la justification
  // complète (pas de passage par la messagerie, garde-fou SSRF).

  creerUrlUploadPreuvePaiement(driverId: string, invoiceId: string, contentType: string) {
    return this.storage.creerUrlUpload(`drivers/${driverId}/invoices/${invoiceId}/proofs`, contentType);
  }

  async soumettrePreuvePaiement(driverId: string, invoiceId: string, userId: string, fileUrl: string, note?: string) {
    const invoice = await this.prisma.driverInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (invoice.driverId !== driverId) {
      throw new BadRequestException("Cette facture n'appartient pas à ce livreur.");
    }
    if (!this.storage.urlEstDansLeBucket(fileUrl)) {
      throw new BadRequestException("Le fichier déposé n'a pas été uploadé via le lien fourni par cette page.");
    }
    const preuve = await this.prisma.driverInvoicePaymentProof.create({
      data: { invoiceId, submittedByUserId: userId, fileUrl, note },
    });
    await this.notifications.notifierMulticanal(await this.idsAdmins(), {
      type: NotificationType.FACTURE_RELANCE,
      title: "Preuve de paiement déposée",
      body: `Un livreur a déposé une preuve de paiement pour une facture de ${Number(invoice.amount).toFixed(2)}.`,
      link: "/admin/factures",
    });
    return preuve;
  }

  listPaymentProofs(invoiceId: string) {
    return this.prisma.driverInvoicePaymentProof.findMany({ where: { invoiceId }, orderBy: { submittedAt: "desc" } });
  }

  listReminders(invoiceId: string) {
    return this.prisma.driverInvoiceReminder.findMany({ where: { invoiceId }, orderBy: { sentAt: "desc" } });
  }

  listInvoices(driverId: string) {
    return this.prisma.driverInvoice.findMany({ where: { driverId }, orderBy: { createdAt: "desc" } });
  }

  /** Vue admin transversale : toutes les factures livreurs, avec son nom. */
  listAllInvoices() {
    return this.prisma.driverInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { driver: { select: { id: true, user: { select: { fullName: true } } } } },
    });
  }
}
