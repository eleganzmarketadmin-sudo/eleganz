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
  // Barème configuré pour référence (13 nov. 2026, signalement point 3) —
  // affiché même quand la règle n'est pas simulable automatiquement (cas de
  // PROGRESSIF, voir FiscalRuleTrancheMode dans schema.prisma), pour que
  // l'admin voie les plages réelles sans avoir à rouvrir le formulaire.
  tranches?: Tranche[];
}

interface Tranche {
  min: number;
  max: number | null;
  taux: number;
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
      const { base, montantBase } = this.baseParCategorie(regle.category, ca, resultatNet, chargesPersonnel);
      const tranches = this.normaliserTranches(regle.tranches);

      if (tranches && tranches.length > 0 && regle.trancheMode) {
        if (regle.trancheMode === "PALIER") {
          // PALIER : une seule tranche s'applique, choisie par une valeur de
          // référence distincte du montant imposé (ex. INPP par effectif).
          const refValeur =
            regle.trancheReferenceValeur != null ? Number(regle.trancheReferenceValeur) : null;
          const trancheChoisie =
            refValeur != null
              ? tranches.find((tr) => refValeur >= tr.min && (tr.max == null || refValeur <= tr.max))
              : undefined;
          if (!trancheChoisie) {
            nonSimulables.push({
              ruleId: regle.id,
              label: regle.label,
              rateOrFormula: regle.rateOrFormula,
              motif: regle.trancheReferenceValeur == null
                ? `Barème par palier configuré, mais "${regle.trancheReferenceLabel ?? "la valeur de référence"}" n'est pas renseigné — aucune tranche ne peut être choisie.`
                : `Barème par palier configuré, mais aucune tranche ne couvre la valeur de référence actuelle (${regle.trancheReferenceLabel ?? "référence"} = ${refValeur}).`,
              tranches,
            });
            continue;
          }
          lignes.push({
            ruleId: regle.id,
            label: regle.label,
            category: regle.category,
            rateOrFormula: regle.rateOrFormula,
            base,
            montantBase,
            taux: trancheChoisie.taux,
            montantEstime: Math.round(montantBase * (trancheChoisie.taux / 100) * 100) / 100,
          });
          continue;
        }

        // PROGRESSIF : chaque tranche ne s'applique qu'à la portion de
        // revenu de CHAQUE personne (ex. IRPP), jamais à une masse agrégée —
        // l'appliquer à `montantBase` (le total du compte 661, par exemple)
        // surestimerait l'impôt. Jamais deviné : toujours non simulable,
        // tranches affichées pour référence et modifiables depuis le Centre
        // de pilotage.
        nonSimulables.push({
          ruleId: regle.id,
          label: regle.label,
          rateOrFormula: regle.rateOrFormula,
          motif:
            "Barème progressif par tranche de revenu individuel — une simulation sur une masse agrégée surestimerait l'impôt (chaque tranche s'applique au revenu de chaque personne, jamais à leur somme). Non simulable automatiquement tant qu'une paie individuelle n'est pas suivie.",
          tranches,
        });
        continue;
      }

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

  private baseParCategorie(
    category: string,
    ca: number,
    resultatNet: number,
    chargesPersonnel: number,
  ): { base: string; montantBase: number } {
    switch (category) {
      case "TVA":
        return { base: "Chiffre d'affaires (produits)", montantBase: ca };
      case "IMPOT":
        return { base: "Résultat net (si positif, sinon 0)", montantBase: Math.max(resultatNet, 0) };
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
        return { base: "Charges de personnel (compte 661)", montantBase: chargesPersonnel };
      default:
        return { base: "Chiffre d'affaires (produits) — base approximative par défaut", montantBase: ca };
    }
  }

  // Les tranches viennent de la base comme Prisma.JsonValue (forme non
  // garantie à la compilation) — jamais fait confiance sans validation :
  // une tranche malformée (champ manquant, type incorrect) est purement et
  // simplement ignorée plutôt que de risquer un calcul silencieusement faux.
  private normaliserTranches(valeur: unknown): Tranche[] | null {
    if (!Array.isArray(valeur)) return null;
    const tranches: Tranche[] = [];
    for (const item of valeur) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).min === "number" &&
        typeof (item as Record<string, unknown>).taux === "number"
      ) {
        const max = (item as Record<string, unknown>).max;
        tranches.push({
          min: (item as Record<string, unknown>).min as number,
          max: typeof max === "number" ? max : null,
          taux: (item as Record<string, unknown>).taux as number,
        });
      }
    }
    if (tranches.length === 0) return null;
    return tranches.sort((a, b) => a.min - b.min);
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
