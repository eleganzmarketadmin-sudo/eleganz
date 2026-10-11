import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ShopStatus } from "@eleganz/database";

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fait passer les boutiques dont la période gratuite est écoulée de
   * FREE_PERIOD à PAYMENT_DUE et génère la facture correspondante
   * (décision #3 : durée configurable par boutique, décompte à partir de
   * `freeTrialStartedAt`, jamais depuis une date fixe globale).
   * TODO : brancher sur un planificateur réel (ex. @nestjs/schedule + cron
   * quotidien) une fois en production — pour l'instant déclenché manuellement
   * par un administrateur via POST /admin/billing/run-trial-check.
   */
  async processTrialExpirations() {
    const now = new Date();
    const candidates = await this.prisma.shop.findMany({
      where: { status: ShopStatus.FREE_PERIOD, openingFeeWaived: true },
    });

    const results: { shopId: string; action: string }[] = [];

    for (const shop of candidates) {
      if (!shop.freeTrialStartedAt) continue;
      const trialEndsAt = new Date(shop.freeTrialStartedAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + shop.freeTrialDurationDays);

      if (now >= trialEndsAt) {
        await this.prisma.$transaction([
          this.prisma.shop.update({
            where: { id: shop.id },
            data: { status: ShopStatus.PAYMENT_DUE, openingFeeWaived: false },
          }),
          this.prisma.invoice.create({
            data: {
              shopId: shop.id,
              amount: 100, // frais d'ouverture indicatif — voir DECISIONS.md, à administrer réellement via SubscriptionPlan
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
   * Suspend les boutiques dont une facture est impayée depuis plus de
   * `graceDays` après son échéance (prompt §31 : 7 jours par défaut,
   * entièrement configurable). Ne touche jamais aux commandes, produits,
   * factures ou historiques déjà existants — seulement au statut d'accès.
   */
  async suspendOverdueShops(graceDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: "PENDING", dueAt: { lt: cutoff } },
    });

    const shopIds = [...new Set(overdueInvoices.map((i) => i.shopId))];
    const results: { shopId: string; action: string }[] = [];

    for (const shopId of shopIds) {
      await this.prisma.shop.update({ where: { id: shopId }, data: { status: ShopStatus.SUSPENDED } });
      results.push({ shopId, action: "suspended" });
    }

    return results;
  }

  /**
   * Réactivation après paiement confirmé. Une boutique suspendue conserve
   * tout son historique (prompt §31) — la réactivation ne fait que changer
   * le statut et solder la facture.
   */
  async markInvoicePaidAndReactivate(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    return this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }),
      this.prisma.shop.update({ where: { id: invoice.shopId }, data: { status: ShopStatus.ACTIVE } }),
    ]);
  }

  listInvoices(shopId: string) {
    return this.prisma.invoice.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
  }
}
