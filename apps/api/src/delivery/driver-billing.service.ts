import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DriverBillingStatus } from "@eleganz/database";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
import { AccountingService } from "../finance/accounting.service";

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
 */
@Injectable()
export class DriverBillingService {
  private readonly logger = new Logger(DriverBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly accounting: AccountingService,
  ) {}

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
   * Suspend les livreurs dont une facture est impayée depuis plus de
   * `graceDays` après son échéance (même logique que suspendOverdueShops).
   * Ne touche jamais à l'historique des livraisons déjà effectuées —
   * seulement au statut de facturation, qui bloque les nouvelles
   * affectations (voir DeliveryService.assignDriver).
   */
  async suspendOverdueDrivers(graceDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const overdueInvoices = await this.prisma.driverInvoice.findMany({
      where: { status: "PENDING", dueAt: { lt: cutoff } },
    });

    const driverIds = [...new Set(overdueInvoices.map((i) => i.driverId))];
    const results: { driverId: string; action: string }[] = [];

    for (const driverId of driverIds) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { billingStatus: DriverBillingStatus.SUSPENDED },
      });
      results.push({ driverId, action: "suspended" });
    }

    return results;
  }

  async markInvoicePaidAndReactivate(invoiceId: string) {
    const invoice = await this.prisma.driverInvoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const [updatedInvoice] = await this.prisma.$transaction([
      this.prisma.driverInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }),
      this.prisma.driver.update({
        where: { id: invoice.driverId },
        data: { billingStatus: DriverBillingStatus.ACTIVE },
      }),
    ]);

    await this.accounting.postPlatformInvoicePaid(updatedInvoice, "driverInvoice").catch((err) => {
      this.logger.error(`Comptabilisation de la facture livreur ${invoiceId} échouée`, err);
    });

    return [updatedInvoice];
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
