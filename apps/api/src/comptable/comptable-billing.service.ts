import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ComptableBillingStatus } from "@eleganz/database";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { AccountingService } from "../finance/accounting.service";

/**
 * Facturation d'ELEGANZ Secourable (prompt du 13 oct. 2026, §14) — même
 * découpage que DriverBillingService/BillingService : déclenchement manuel
 * des transitions de cycle tant qu'aucun planificateur n'est en place.
 * `freeTrialStartedAt` est posé dès la création de l'abonnement (= première
 * activation effective), jamais à la création du compte ELEGANZ.
 */
@Injectable()
export class ComptableBillingService {
  private readonly logger = new Logger(ComptableBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly accounting: AccountingService,
  ) {}

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
   * Suspend après impayé, avec une période de grâce configurable (prompt
   * §14 : « applique une période de grâce configurable »). Ne supprime
   * jamais les historiques — seulement le statut, qui peut limiter les
   * nouvelles saisies côté écran.
   */
  async suspendOverdueSubscriptions(graceDays = 14) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const overdueInvoices = await this.prisma.comptableInvoice.findMany({
      where: { status: "PENDING", dueAt: { lt: cutoff } },
    });

    const subscriptionIds = [...new Set(overdueInvoices.map((i) => i.subscriptionId))];
    const results: { subscriptionId: string; action: string }[] = [];

    for (const subscriptionId of subscriptionIds) {
      await this.prisma.comptableSubscription.update({
        where: { id: subscriptionId },
        data: { billingStatus: ComptableBillingStatus.SUSPENDED },
      });
      results.push({ subscriptionId, action: "suspended" });
    }

    return results;
  }

  async markInvoicePaidAndReactivate(invoiceId: string) {
    const invoice = await this.prisma.comptableInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const sub = await this.prisma.comptableSubscription.findUniqueOrThrow({ where: { id: invoice.subscriptionId } });
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + (sub.plan === "YEARLY" ? 12 : 1));

    const resultats = await this.prisma.$transaction([
      this.prisma.comptableInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }),
      this.prisma.comptableSubscription.update({
        where: { id: invoice.subscriptionId },
        data: { billingStatus: ComptableBillingStatus.ACTIVE, renewsAt },
      }),
    ]);

    await this.accounting.postPlatformInvoicePaid(resultats[0], "comptableInvoice").catch((err) => {
      this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la facture Secourable ${invoiceId} échouée`, err);
    });

    return resultats;
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
