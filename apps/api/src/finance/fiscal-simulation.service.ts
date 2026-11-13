import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { FiscalRuleScope, FiscalRuleStatus } from "@eleganz/database";

interface LigneSimulation {
  ruleId: string;
  label: string;
  category: string;
  rateOrFormula: string;
  base: string;
  montantBase: number;
  taux: number;
  montantEstime: number;
}

interface RegleNonSimulable {
  ruleId: string;
  label: string;
  rateOrFormula: string;
  motif: string;
}

/**
 * Simulation fiscale (docs/ARCHITECTURE_FINANCE.md §8septies) — à partir des
 * règles fiscales réellement configurées (FiscalRule) et des données
 * comptables réelles de la période (AccountingQueryService), **jamais** une
 * déclaration officielle : un simple ordre de grandeur, toujours étiqueté
 * comme simulation. Une règle dont `rateOrFormula` n'est pas un pourcentage
 * simple (ex. "forfait 50 USD", une formule complexe en texte libre) n'est
 * jamais devinée ni ignorée silencieusement : elle est listée à part, comme
 * non simulable automatiquement.
 */
@Injectable()
export class FiscalSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
  ) {}

  async simulerShop(shopId: string, from: Date, to: Date) {
    return this.simuler(FiscalRuleScope.SHOP, shopId, from, to);
  }

  /**
   * Simulation fiscale d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct.
   * 2026 — "fonctionnalités développées côté Gestion pas implémentées en
   * détail au Centre de pilotage") : jusqu'ici, cette simulation n'existait
   * QUE pour une boutique — ELEGANZ en tant que société ne pouvait estimer
   * sa propre charge fiscale avec le même outil qu'elle impose aux
   * boutiques. Même logique, scope PLATFORM, `shopId: null` (déjà supporté
   * par AccountingQueryService.compteDeResultat).
   */
  async simulerPlateforme(from: Date, to: Date) {
    return this.simuler(FiscalRuleScope.PLATFORM, null, from, to);
  }

  private async simuler(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const regles = await this.prisma.fiscalRule.findMany({
      where: {
        scope,
        shopId,
        status: { in: [FiscalRuleStatus.CONFIGUREE, FiscalRuleStatus.VERIFIEE] },
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
    });

    const compteResultat = await this.accountingQuery.compteDeResultat(scope, shopId, from, to);
    const ca = compteResultat.totalProduits;
    const resultatNet = compteResultat.resultatNet;
    const chargesPersonnel = compteResultat.charges.find((c) => c.code === "661")?.montant ?? 0;

    const lignes: LigneSimulation[] = [];
    const nonSimulables: RegleNonSimulable[] = [];

    for (const regle of regles) {
      const taux = this.parserTaux(regle.rateOrFormula);
      if (taux === null) {
        nonSimulables.push({
          ruleId: regle.id,
          label: regle.label,
          rateOrFormula: regle.rateOrFormula,
          motif:
            "Le taux ou la formule n'est pas un pourcentage simple — simulation automatique impossible, calcul manuel nécessaire.",
        });
        continue;
      }

      let base: string;
      let montantBase: number;
      switch (regle.category) {
        case "TVA":
          base = "Chiffre d'affaires (produits)";
          montantBase = ca;
          break;
        case "IMPOT":
          base = "Résultat net (si positif, sinon 0)";
          montantBase = Math.max(resultatNet, 0);
          break;
        case "RETENUE":
        // CONTRIBUTION ajouté le 13 nov. 2026 (mise en place des obligations
        // sociales d'ELEGANZ elle-même — CNSS, INPP, ONEM) : ces cotisations
        // parafiscales se calculent toujours sur la masse salariale, jamais
        // sur le chiffre d'affaires. Avant ce correctif, une règle
        // CONTRIBUTION simulable (ex. "13%") tombait dans le `default`
        // ci-dessous et était donc estimée sur le chiffre d'affaires — un
        // montant sans rapport avec la charge sociale réelle, silencieux
        // puisque la règle restait "simulable".
        case "CONTRIBUTION":
          base = "Charges de personnel (compte 661)";
          montantBase = chargesPersonnel;
          break;
        default:
          base = "Chiffre d'affaires (produits) — base approximative par défaut";
          montantBase = ca;
      }

      lignes.push({
        ruleId: regle.id,
        label: regle.label,
        category: regle.category,
        rateOrFormula: regle.rateOrFormula,
        base,
        montantBase,
        taux,
        montantEstime: Math.round(montantBase * (taux / 100) * 100) / 100,
      });
    }

    const totalEstime = lignes.reduce((s, l) => s + l.montantEstime, 0);

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      chiffreAffaires: ca,
      resultatNet,
      lignes,
      nonSimulables,
      totalEstime,
    };
  }

  private parserTaux(rateOrFormula: string): number | null {
    const m = rateOrFormula.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
    if (!m) return null;
    return Number(m[1].replace(",", "."));
  }

  // --- Relevé (simulation + reversements réels) --------------------------
  // 13 nov. 2026, signalement : "aucune option pour voir les récap/relevés
  // (par types d'impôt/retenue etc.) qu'on peut s'en servir ... pour la
  // déclaration ou contre-vérification ... et pour les reversements". La
  // simulation seule (ci-dessus) ne dit que ce qui est estimé dû ; le relevé
  // y ajoute ce qui a RÉELLEMENT été reversé (FiscalRemittance), ligne par
  // ligne, y compris pour les règles non simulables (IRPP, INPP) qui ont
  // quand même des reversements à suivre.

  async releveShop(shopId: string, from: Date, to: Date) {
    return this.releve(FiscalRuleScope.SHOP, shopId, from, to);
  }

  async relevePlatform(from: Date, to: Date) {
    return this.releve(FiscalRuleScope.PLATFORM, null, from, to);
  }

  private async releve(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const simulation = await this.simuler(scope, shopId, from, to);

    const ruleIds = [
      ...simulation.lignes.map((l) => l.ruleId),
      ...simulation.nonSimulables.map((r) => r.ruleId),
    ];
    const reversements = ruleIds.length
      ? await this.prisma.fiscalRemittance.findMany({
          where: { ruleId: { in: ruleIds }, periodFrom: { lte: to }, periodTo: { gte: from } },
          orderBy: { paidAt: "desc" },
        })
      : [];

    const parRegle = new Map<string, { verse: number; declare: number }>();
    for (const r of reversements) {
      const cumul = parRegle.get(r.ruleId) ?? { verse: 0, declare: 0 };
      cumul.verse += Number(r.paidAmount);
      cumul.declare += r.declaredAmount != null ? Number(r.declaredAmount) : 0;
      parRegle.set(r.ruleId, cumul);
    }

    const lignes = simulation.lignes.map((l) => {
      const montantVerse = parRegle.get(l.ruleId)?.verse ?? 0;
      return {
        ...l,
        montantVerse,
        solde: Math.round((l.montantEstime - montantVerse) * 100) / 100,
      };
    });

    const nonSimulables = simulation.nonSimulables.map((r) => ({
      ...r,
      montantVerse: parRegle.get(r.ruleId)?.verse ?? 0,
      montantDeclare: parRegle.get(r.ruleId)?.declare ?? 0,
    }));

    return {
      ...simulation,
      lignes,
      nonSimulables,
      totalVerse: reversements.reduce((s, r) => s + Number(r.paidAmount), 0),
      reversements,
    };
  }
}
