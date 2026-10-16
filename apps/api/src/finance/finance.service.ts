import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateFiscalIdentityDto } from "./dto/update-fiscal-identity.dto";
import { AccountingQueryService } from "./accounting-query.service";
import { FiscalRuleScope, StockMovementType } from "@eleganz/database";

export interface DossierCreditBoutique {
  shopId: string;
  shopName: string;
  boutiqueDepuis: string;
  identiteFiscale: {
    fiscalLegalName: string | null;
    fiscalIdNumber: string | null;
    fiscalAddress: string | null;
    fiscalRegime: string | null;
  };
  historiqueMensuel: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[];
  bilan: { totalActif: number; totalPassif: number; equilibre: boolean };
  dettesFournisseurs: number;
  creditClientAccorde: number;
  genereLe: string;
  codeVerification: string;
}

/**
 * Tableau de bord financier boutique (prompt du 13 oct. 2026, §7) —
 * agrège des opérations réelles déjà enregistrées ailleurs (voir
 * docs/ARCHITECTURE_FINANCE.md §4). Chaque chiffre reste une estimation
 * explicitement étiquetée comme telle : ce n'est ni un bilan ni un résultat
 * certifié, juste une lecture consolidée de ce qui existe déjà.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
  ) {}

  fiscalIdentity(shopId: string) {
    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        fiscalLegalName: true,
        fiscalLegalForm: true,
        fiscalIdNumber: true,
        fiscalAddress: true,
        fiscalJurisdiction: true,
        fiscalRegime: true,
        fiscalExercice: true,
        fiscalVatRegistered: true,
      },
    });
  }

  updateFiscalIdentity(shopId: string, dto: UpdateFiscalIdentityDto) {
    return this.prisma.shop.update({ where: { id: shopId }, data: dto });
  }

  async dashboardForShop(shopId: string, from: Date, to: Date) {
    const [posSales, shopOrders, expenses, purchases, supplier, customers, cmvAgg, cmvInconnuCount] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { shopId, createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        include: { lines: true, payments: true },
      }),
      this.prisma.shopOrder.findMany({
        where: { shopId, createdAt: { gte: from, lt: to } },
        select: { subtotal: true, commissionAmount: true },
      }),
      this.prisma.expense.groupBy({
        by: ["currency"],
        where: { shopId, createdAt: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
      this.prisma.purchase.findMany({
        where: { supplier: { shopId }, createdAt: { gte: from, lt: to } },
        select: { amount: true },
      }),
      this.prisma.supplier.aggregate({ where: { shopId }, _sum: { balanceOwed: true } }),
      this.prisma.shopCustomer.aggregate({ where: { shopId }, _sum: { creditBalance: true } }),
      // CMV réellement comptabilisé (valorisation CUMP des sorties de caisse,
      // chantier SYSCOHADA phase 4b) — remplace l'ancien calcul approximatif
      // à partir de Variant.costPrice (champ manuel séparé, jamais tenu à
      // jour par la comptabilité). `valeur` porte déjà le signe négatif
      // d'une sortie ; la somme sur la période donne directement le CMV
      // (voir packages/database/prisma/schema.prisma, StockMovement).
      this.prisma.stockMovement.aggregate({
        where: { shopId, type: StockMovementType.POS_SALE_OUT, createdAt: { gte: from, lt: to } },
        _sum: { valeur: true },
      }),
      this.prisma.stockMovement.count({
        where: { shopId, type: StockMovementType.POS_SALE_OUT, createdAt: { gte: from, lt: to }, valeur: null },
      }),
    ]);

    // Dotations aux amortissements (681) réellement comptabilisées sur la
    // période — absentes jusqu'ici du tableau de bord, qui ne regardait que
    // Purchase/Expense et jamais le journal. Sans cette ligne, le résultat
    // estimé pouvait afficher un bénéfice le même mois où le compte de
    // résultat affichait une perte (voir docs/PLAN_COMMERCIAL.md, point
    // challengé n°1, confirmé et corrigé le 14 oct. 2026).
    const amortissements = await this.accountingQuery.soldeCompte(FiscalRuleScope.SHOP, shopId, "681", {
      gte: from,
      lt: to,
    });
    // Créance Marketplace (411) réellement comptabilisée, cumulée depuis
    // l'origine jusqu'à `to` — à ne pas confondre avec `creancesClients`
    // ci-dessous, qui mesure autre chose (voir point challengé n°2).
    const creancesMarketplace411 = await this.accountingQuery.soldeCompte(FiscalRuleScope.SHOP, shopId, "411", {
      lt: to,
    });

    const caBoutique = posSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const caMarketplace = shopOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const encaissementsConfirmes = posSales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0),
      0,
    );

    // Marge brute harmonisée avec le CUMP réellement comptabilisé (14 oct.
    // 2026, chantier SYSCOHADA) : auparavant recalculée ligne par ligne à
    // partir de Variant.costPrice (un champ manuel, jamais synchronisé avec
    // les réceptions de stock), ce qui pouvait diverger du CMV réellement
    // posté en comptabilité (compte 603) pour les mêmes ventes. Le CMV de la
    // période vient maintenant exclusivement des StockMovement(POS_SALE_OUT)
    // déjà valorisés au CUMP lors de la vente (voir pos.service.ts). Une
    // vente rapide sans article catalogué (pas de variantId) n'a et n'aura
    // jamais de coût connu : sa présence rend la marge de la période non
    // fiable, comme avant.
    const venteSansVariante = posSales.some((s) => s.lines.some((l) => !l.variantId));
    const margeConnuePourTout = cmvInconnuCount === 0 && !venteSansVariante;
    const cmvPeriode = -(Number(cmvAgg._sum.valeur ?? 0));
    const margeBrute = caBoutique - cmvPeriode;

    const achats = purchases.reduce((sum, p) => sum + Number(p.amount), 0);
    const chargesParDevise = Object.fromEntries(
      expenses.map((e) => [e.currency, Number(e._sum.amount ?? 0)]),
    );
    const totalCharges = expenses.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);

    const commissionMarketplace = shopOrders.reduce((sum, o) => sum + Number(o.commissionAmount), 0);

    const chiffreAffaires = caBoutique + caMarketplace;
    const resultatEstime = chiffreAffaires - achats - totalCharges - amortissements;

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      chiffreAffaires: { total: chiffreAffaires, boutique: caBoutique, marketplace: caMarketplace },
      encaissementsConfirmes,
      achats,
      charges: { total: totalCharges, parDevise: chargesParDevise },
      amortissements,
      margeBrute: margeConnuePourTout ? margeBrute : null,
      margeFiable: margeConnuePourTout,
      resultatEstime,
      dettesFournisseurs: Number(supplier._sum.balanceOwed ?? 0),
      // Renommé explicitement : ce champ mesure le crédit accordé aux clients
      // (ShopCustomer.creditBalance, alimenté par les ventes à crédit), pas la
      // créance envers la plateforme Marketplace — voir `creancesMarketplace411`
      // ci-dessous pour celle-ci (point challengé n°2, corrigé le 14 oct. 2026).
      creditClientAccorde: Number(customers._sum.creditBalance ?? 0),
      creancesMarketplace411,
      // Commission marketplace : ShopOrder.commissionAmount n'est actuellement
      // jamais calculé par l'API (voir docs/ARCHITECTURE_FINANCE.md §2) — ce
      // champ reflète donc la réalité (toujours 0) plutôt qu'une estimation
      // inventée, avec le statut explicite ci-dessous.
      commissionMarketplace,
      statut: {
        resultat: "estimation — non certifié, non audité",
        commission: "non implémentée côté marketplace à ce jour",
        dettesFournisseurs:
          "solde cumulé, sans historique détaillé des mouvements à cette phase",
        creancesMarketplace411:
          "solde cumulé du compte 411 — ne se solde jamais automatiquement tant qu'aucun reversement réel de fonds par la plateforme n'est modélisé",
      },
    };
  }

  /**
   * Dossier de crédit boutique (demande du 16 oct. 2026, point 1) — même
   * esprit que le "Dossier de financement" d'ELEGANZ Mon assistant
   * (comptable-export.service.ts), mais assemblé à partir des ÉCRITURES
   * COMPTABLES réelles de la boutique (plus fiable qu'une simple
   * déclaration) plutôt que des activités/dépenses déclaratives d'un
   * indépendant. Toujours calculé à la volée, jamais persisté : ce n'est
   * pas un état financier certifié, seulement un dossier préparatoire à
   * joindre à une demande de crédit auprès d'une institution financière.
   */
  async dossierCredit(shopId: string, nombreMois = 6): Promise<DossierCreditBoutique> {
    const [shop, identite, historiqueMensuel, bilan, supplier, customers] = await Promise.all([
      this.prisma.shop.findUniqueOrThrow({ where: { id: shopId }, select: { name: true, createdAt: true } }),
      this.fiscalIdentity(shopId),
      this.accountingQuery.evolutionMensuelle(FiscalRuleScope.SHOP, shopId, Math.min(Math.max(nombreMois, 1), 24)),
      this.accountingQuery.bilan(FiscalRuleScope.SHOP, shopId, new Date()),
      this.prisma.supplier.aggregate({ where: { shopId }, _sum: { balanceOwed: true } }),
      this.prisma.shopCustomer.aggregate({ where: { shopId }, _sum: { creditBalance: true } }),
    ]);

    const genereLe = new Date().toISOString();
    const codeVerification = createHash("sha256")
      .update([shopId, genereLe, JSON.stringify(historiqueMensuel), bilan.totalActif, bilan.totalPassif].join("|"))
      .digest("hex")
      .slice(0, 12)
      .toUpperCase();

    return {
      shopId,
      shopName: shop.name,
      boutiqueDepuis: shop.createdAt.toISOString(),
      identiteFiscale: {
        fiscalLegalName: identite.fiscalLegalName,
        fiscalIdNumber: identite.fiscalIdNumber,
        fiscalAddress: identite.fiscalAddress,
        fiscalRegime: identite.fiscalRegime,
      },
      historiqueMensuel,
      bilan: { totalActif: bilan.totalActif, totalPassif: bilan.totalPassif, equilibre: bilan.equilibre },
      dettesFournisseurs: Number(supplier._sum.balanceOwed ?? 0),
      creditClientAccorde: Number(customers._sum.creditBalance ?? 0),
      genereLe,
      codeVerification,
    };
  }
}
