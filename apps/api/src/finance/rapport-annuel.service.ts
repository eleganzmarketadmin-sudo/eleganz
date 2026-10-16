import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { FiscalRuleScope } from "@eleganz/database";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { AdminFinanceService } from "./admin-finance.service";

export interface RapportAnnuelDonnees {
  scope: FiscalRuleScope;
  entiteNom: string;
  annee: number;
  identiteFiscale: {
    fiscalLegalName: string | null;
    fiscalIdNumber: string | null;
    fiscalAddress: string | null;
    fiscalRegime: string | null;
  };
  chiffresCles: {
    chiffreAffaires: number;
    charges: number;
    resultatNet: number;
    margeNette: number | null;
    croissanceCA: number | null;
  };
  evolutionMensuelle: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[];
  compteDeResultat: Awaited<ReturnType<AccountingQueryService["compteDeResultatNormalise"]>>;
  bilan: Awaited<ReturnType<AccountingQueryService["bilanNormalise"]>>;
  repartitionProduits: { label: string; montant: number }[];
  genereLe: string;
  codeVerification: string;
}

/**
 * Rapport annuel (demande du 16 oct. 2026, point 3) — aux normes
 * professionnelles internationales (SYSCOHADA/OHADA, déjà la base de la
 * comptabilité ELEGANZ, voir accounting-query.service.ts), un seul service
 * paramétré par scope (SHOP/PLATFORM) + shopId nullable, même patron que
 * BusinessPlanService/AdminFinanceService.dossierCredit — pour servir à la
 * fois les boutiques et ELEGANZ elle-même sans dupliquer l'assemblage.
 * Jamais persisté, toujours recalculé depuis les écritures réelles de
 * l'année demandée.
 */
@Injectable()
export class RapportAnnuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
    private readonly adminFinanceService: AdminFinanceService,
  ) {}

  async assembler(scope: FiscalRuleScope, shopId: string | null, annee: number): Promise<RapportAnnuelDonnees> {
    const from = new Date(Date.UTC(annee, 0, 1));
    const to = new Date(Date.UTC(annee + 1, 0, 1));
    const maintenant = new Date();
    const asOf = to < maintenant ? to : maintenant;

    const [identite, compteDeResultat, bilan, evolutionMensuelle, resultatAnneePrecedente] = await Promise.all([
      this.identite(scope, shopId),
      this.accountingQuery.compteDeResultatNormalise(scope, shopId, from, to),
      this.accountingQuery.bilanNormalise(scope, shopId, asOf),
      this.evolutionMensuelleAnnee(scope, shopId, annee),
      this.accountingQuery.compteDeResultat(
        scope,
        shopId,
        new Date(Date.UTC(annee - 1, 0, 1)),
        new Date(Date.UTC(annee, 0, 1)),
      ),
    ]);

    const chiffreAffaires = compteDeResultat.exploitation.produits.reduce((s, p) => s + p.montant, 0);
    const charges =
      compteDeResultat.exploitation.charges.reduce((s, c) => s + c.montant, 0) +
      compteDeResultat.financier.charges.reduce((s, c) => s + c.montant, 0) +
      compteDeResultat.hao.charges.reduce((s, c) => s + c.montant, 0);
    const resultatNet = compteDeResultat.resultatNetAvantImpot;
    const margeNette = chiffreAffaires > 0 ? (resultatNet / chiffreAffaires) * 100 : null;
    const caAnneePrecedente = resultatAnneePrecedente.totalProduits;
    const croissanceCA = caAnneePrecedente > 0 ? ((chiffreAffaires - caAnneePrecedente) / caAnneePrecedente) * 100 : null;

    const repartitionProduits =
      scope === FiscalRuleScope.PLATFORM
        ? await this.repartitionProduitsPlateforme(from, asOf)
        : [...compteDeResultat.exploitation.charges]
            .sort((a, b) => b.montant - a.montant)
            .slice(0, 5)
            .map((c) => ({ label: c.label, montant: c.montant }));

    const genereLe = new Date().toISOString();
    const codeVerification = createHash("sha256")
      .update([scope, shopId ?? "PLATFORM", annee, genereLe, chiffreAffaires, resultatNet, bilan.totalActif].join("|"))
      .digest("hex")
      .slice(0, 12)
      .toUpperCase();

    return {
      scope,
      entiteNom: identite.entiteNom,
      annee,
      identiteFiscale: {
        fiscalLegalName: identite.fiscalLegalName,
        fiscalIdNumber: identite.fiscalIdNumber,
        fiscalAddress: identite.fiscalAddress,
        fiscalRegime: identite.fiscalRegime,
      },
      chiffresCles: { chiffreAffaires, charges, resultatNet, margeNette, croissanceCA },
      evolutionMensuelle,
      compteDeResultat,
      bilan,
      repartitionProduits,
      genereLe,
      codeVerification,
    };
  }

  private async evolutionMensuelleAnnee(scope: FiscalRuleScope, shopId: string | null, annee: number) {
    const serie: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[] = [];
    for (let mois = 0; mois < 12; mois++) {
      const debut = new Date(Date.UTC(annee, mois, 1));
      const fin = new Date(Date.UTC(annee, mois + 1, 1));
      const cr = await this.accountingQuery.compteDeResultat(scope, shopId, debut, fin);
      serie.push({
        mois: debut.toISOString().slice(0, 7),
        chiffreAffaires: cr.totalProduits,
        charges: cr.totalCharges,
        resultatNet: cr.resultatNet,
      });
    }
    return serie;
  }

  private async identite(scope: FiscalRuleScope, shopId: string | null) {
    if (scope === FiscalRuleScope.SHOP && shopId) {
      const shop = await this.prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { name: true, fiscalLegalName: true, fiscalIdNumber: true, fiscalAddress: true, fiscalRegime: true },
      });
      return {
        entiteNom: shop.name,
        fiscalLegalName: shop.fiscalLegalName,
        fiscalIdNumber: shop.fiscalIdNumber,
        fiscalAddress: shop.fiscalAddress,
        fiscalRegime: shop.fiscalRegime,
      };
    }
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: "platform" } });
    return {
      entiteNom: "ELEGANZ",
      fiscalLegalName: settings?.platformFiscalLegalName ?? null,
      fiscalIdNumber: settings?.platformFiscalIdNumber ?? null,
      fiscalAddress: settings?.platformFiscalAddress ?? null,
      fiscalRegime: settings?.platformFiscalRegime ?? null,
    };
  }

  /**
   * Répartition des revenus d'ELEGANZ par source (jamais le volume des
   * transactions vendeurs, voir AdminFinanceService.dashboard — séparation
   * stricte imposée). Revenus réellement encaissés sur l'année, pas
   * seulement facturés.
   */
  private async repartitionProduitsPlateforme(from: Date, to: Date) {
    const dashboard = await this.adminFinanceService.dashboard(from, to);
    return [
      { label: "Abonnements boutique", montant: dashboard.parSource.abonnementsBoutique.encaisse },
      { label: "Frais livreur", montant: dashboard.parSource.fraisLivreur.encaisse },
      { label: "Abonnements ELEGANZ Secourable", montant: dashboard.parSource.abonnementsComptable.encaisse },
    ].filter((r) => r.montant > 0);
  }
}
