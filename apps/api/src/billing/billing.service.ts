import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus, ShopStatus } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";

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
  ) {}

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
   * d'ouverture payé (contrairement aux livreurs et à Mon Comptable, qui
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

    const resultats = await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }),
      this.prisma.shop.update({ where: { id: invoice.shopId }, data: { status: ShopStatus.ACTIVE } }),
    ]);

    // Revenu ELEGANZ reconnu au règlement effectif, jamais à la facturation
    // (docs/ARCHITECTURE_FINANCE.md §8bis.3).
    await this.accounting.postPlatformInvoicePaid(resultats[0], "invoice").catch((err) => {
      this.logger.error(`Comptabilisation de la facture ${invoiceId} échouée`, err);
    });

    return resultats;
  }

  listInvoices(shopId: string) {
    return this.prisma.invoice.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
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
