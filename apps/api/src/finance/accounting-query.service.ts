import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FiscalRuleScope } from "@eleganz/database";

/**
 * Lecture du journal général, du grand livre et de la balance — à partir des
 * écritures réellement générées par AccountingService. Voir
 * docs/ARCHITECTURE_FINANCE.md §8bis.5. Aucune de ces trois lectures n'est un
 * état financier réglementaire (bilan/compte de résultat/TFT) : ce sont des
 * vues brutes des écritures, pas des regroupements par classe de compte.
 */
@Injectable()
export class AccountingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async journal(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date, journalCode?: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        scope,
        shopId,
        entryDate: { gte: from, lt: to },
        ...(journalCode ? { journal: { code: journalCode } } : {}),
      },
      include: { journal: true, lines: { include: { account: true } } },
      orderBy: { entryDate: "asc" },
    });
  }

  async grandLivre(scope: FiscalRuleScope, shopId: string | null, accountCode: string, from: Date, to: Date) {
    const lignes = await this.prisma.journalLine.findMany({
      where: {
        account: { scope, shopId, code: accountCode },
        entry: { entryDate: { gte: from, lt: to } },
      },
      include: { entry: true, account: true },
      orderBy: { entry: { entryDate: "asc" } },
    });

    let solde = 0;
    const mouvements = lignes.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      solde += debit - credit;
      return {
        date: l.entry.entryDate,
        label: l.label ?? l.entry.label,
        sourceType: l.entry.sourceType,
        debit,
        credit,
        soldeCumule: solde,
      };
    });

    return { compte: accountCode, mouvements, soldeFinal: solde };
  }

  async balance(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const comptes = await this.prisma.account.findMany({ where: { scope, shopId, active: true } });
    const entrees = comptes.length
      ? await this.prisma.journalEntry.findMany({
          where: { scope, shopId, entryDate: { gte: from, lt: to } },
          select: { id: true },
        })
      : [];
    const entryIds = entrees.map((e) => e.id);
    const lignes = entryIds.length
      ? await this.prisma.journalLine.groupBy({
          by: ["accountId"],
          where: { entryId: { in: entryIds } },
          _sum: { debit: true, credit: true },
        })
      : [];

    const parCompte = new Map(lignes.map((l) => [l.accountId, l]));
    let totalDebit = 0;
    let totalCredit = 0;
    const comptesAvecMouvement = comptes
      .map((compte) => {
        const agg = parCompte.get(compte.id);
        const debit = Number(agg?._sum.debit ?? 0);
        const credit = Number(agg?._sum.credit ?? 0);
        totalDebit += debit;
        totalCredit += credit;
        return {
          code: compte.code,
          label: compte.label,
          debit,
          credit,
          solde: compte.normalSide === "DEBIT" ? debit - credit : credit - debit,
        };
      })
      .filter((c) => c.debit !== 0 || c.credit !== 0);

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      comptes: comptesAvecMouvement,
      totalDebit,
      totalCredit,
      // Vrai pour toute balance correctement tenue en partie double : si ce
      // n'est pas le cas ici, c'est un signal d'anomalie à afficher, jamais
      // à masquer (voir docs/ARCHITECTURE_FINANCE.md §8bis.5).
      equilibree: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  /**
   * Compte de résultat sur une période [from, to) : charges (classe 6) et
   * produits (classe 7) du plan comptable minimal déjà seedé. Voir
   * docs/ARCHITECTURE_FINANCE.md §8ter — état réglementaire simplifié, pas
   * une liasse fiscale complète (pas de sous-totaux d'exploitation/
   * financier/HAO distincts à ce stade, faute de comptes dédiés).
   */
  async compteDeResultat(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const comptes = await this.prisma.account.findMany({ where: { scope, shopId, active: true } });
    const comptesResultat = comptes.filter((c) => c.code.startsWith("6") || c.code.startsWith("7"));
    const agg = await this.agregerParCompte(
      comptesResultat.map((c) => c.id),
      { gte: from, lt: to },
    );

    const charges: { code: string; label: string; montant: number }[] = [];
    const produits: { code: string; label: string; montant: number }[] = [];
    for (const compte of comptesResultat) {
      const { debit, credit } = agg.get(compte.id) ?? { debit: 0, credit: 0 };
      if (compte.code.startsWith("6")) {
        const montant = debit - credit;
        if (montant !== 0) charges.push({ code: compte.code, label: compte.label, montant });
      } else {
        const montant = credit - debit;
        if (montant !== 0) produits.push({ code: compte.code, label: compte.label, montant });
      }
    }
    const totalCharges = charges.reduce((s, l) => s + l.montant, 0);
    const totalProduits = produits.reduce((s, l) => s + l.montant, 0);

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      charges,
      produits,
      totalCharges,
      totalProduits,
      resultatNet: totalProduits - totalCharges,
    };
  }

  /**
   * Bilan à une date donnée (asOf) : soldes cumulés depuis la toute première
   * écriture pour les comptes de classes 1 à 5 (actif = comptes à solde
   * normal débiteur, passif = comptes à solde normal créditeur), plus le
   * résultat net cumulé depuis l'origine (classes 6/7) placé en capitaux
   * propres au passif pour équilibrer le bilan — convention standard en
   * l'absence d'un compte de capital social saisi par ailleurs. Voir
   * docs/ARCHITECTURE_FINANCE.md §8ter.
   */
  async bilan(scope: FiscalRuleScope, shopId: string | null, asOf: Date) {
    const comptes = await this.prisma.account.findMany({ where: { scope, shopId, active: true } });
    const comptesBilan = comptes.filter((c) => ["1", "2", "3", "4", "5"].includes(c.code[0]));
    const aggBilan = await this.agregerParCompte(
      comptesBilan.map((c) => c.id),
      { lt: asOf },
    );

    const actif: { code: string; label: string; montant: number }[] = [];
    const passif: { code: string; label: string; montant: number }[] = [];
    for (const compte of comptesBilan) {
      const { debit, credit } = aggBilan.get(compte.id) ?? { debit: 0, credit: 0 };
      const solde = compte.normalSide === "DEBIT" ? debit - credit : credit - debit;
      if (solde === 0) continue;
      // Les comptes d'amortissement (classe 28, ex. 2841) sont des
      // contra-actifs : solde normalement créditeur, mais présentés en
      // déduction de l'actif (valeur nette comptable), jamais comme une
      // ligne de passif — voir docs/ARCHITECTURE_FINANCE.md §8quater.
      if (compte.code.startsWith("28")) {
        actif.push({ code: compte.code, label: compte.label, montant: -solde });
        continue;
      }
      const ligne = { code: compte.code, label: compte.label, montant: solde };
      if (compte.normalSide === "DEBIT") actif.push(ligne);
      else passif.push(ligne);
    }

    const comptesResultat = comptes.filter((c) => c.code.startsWith("6") || c.code.startsWith("7"));
    const aggResultat = await this.agregerParCompte(
      comptesResultat.map((c) => c.id),
      { lt: asOf },
    );
    let resultatNet = 0;
    for (const compte of comptesResultat) {
      const { debit, credit } = aggResultat.get(compte.id) ?? { debit: 0, credit: 0 };
      resultatNet += compte.code.startsWith("7") ? credit - debit : -(debit - credit);
    }

    const totalActif = actif.reduce((s, l) => s + l.montant, 0);
    const totalPassifComptes = passif.reduce((s, l) => s + l.montant, 0);
    const passifAvecResultat = [
      ...passif,
      {
        code: "RESULT",
        label: resultatNet >= 0 ? "Résultat net de l'exercice (bénéfice)" : "Résultat net de l'exercice (perte)",
        montant: resultatNet,
      },
    ];
    const totalPassif = totalPassifComptes + resultatNet;

    return {
      asOf: asOf.toISOString(),
      actif,
      passif: passifAvecResultat,
      totalActif,
      totalPassif,
      equilibre: Math.abs(totalActif - totalPassif) < 0.01,
    };
  }

  private async agregerParCompte(
    accountIds: string[],
    periode: { lt: Date } | { gte: Date; lt: Date },
  ): Promise<Map<string, { debit: number; credit: number }>> {
    if (!accountIds.length) return new Map();
    const entryDateFilter = "gte" in periode ? { gte: periode.gte, lt: periode.lt } : { lt: periode.lt };
    const entrees = await this.prisma.journalEntry.findMany({
      where: { entryDate: entryDateFilter, lines: { some: { accountId: { in: accountIds } } } },
      select: { id: true },
    });
    if (!entrees.length) return new Map();
    const lignes = await this.prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { entryId: { in: entrees.map((e) => e.id) }, accountId: { in: accountIds } },
      _sum: { debit: true, credit: true },
    });
    return new Map(
      lignes.map((l) => [l.accountId, { debit: Number(l._sum.debit ?? 0), credit: Number(l._sum.credit ?? 0) }]),
    );
  }

  /**
   * Évolution mensuelle réelle (docs/ARCHITECTURE_FINANCE.md §8octies) —
   * un compte de résultat déjà construit (§8ter), recalculé mois par mois
   * sur les `nombreMois` derniers mois (le mois courant inclus, même
   * partiel). Jamais de donnée inventée pour un mois sans écriture : il
   * apparaît avec des totaux à 0, pas masqué ni interpolé.
   */
  async evolutionMensuelle(scope: FiscalRuleScope, shopId: string | null, nombreMois: number) {
    const maintenant = new Date();
    const serie: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[] = [];
    for (let i = nombreMois - 1; i >= 0; i--) {
      const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i, 1));
      const fin = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
      const cr = await this.compteDeResultat(scope, shopId, debut, fin);
      serie.push({
        mois: debut.toISOString().slice(0, 7),
        chiffreAffaires: cr.totalProduits,
        charges: cr.totalCharges,
        resultatNet: cr.resultatNet,
      });
    }
    return serie;
  }

  /**
   * Relevé de trésorerie réel (docs/ARCHITECTURE_FINANCE.md §8nonies) — les
   * soldes par devise (5711 Caisse USD, 5712 Caisse CDF) existaient déjà
   * dans le grand livre ; cette méthode ajoute le **solde d'ouverture**
   * (cumulé avant `from`) pour que les mouvements de la période partent du
   * bon solde de départ, et non de zéro comme le fait `grandLivre()` (conçu
   * pour une simple consultation de compte, pas un relevé de caisse).
   * Jamais de conversion CDF→USD ici : l'équivalent indicatif, s'il est
   * affiché, est calculé côté écran à partir du taux public déjà existant
   * (`/platform-settings/exchange-rate`), jamais inventé si ce taux n'est
   * pas configuré.
   */
  async releveTresorerie(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const comptesCaisse = await this.prisma.account.findMany({
      where: { scope, shopId, code: { in: ["5711", "5712"] }, active: true },
    });

    const comptes = [];
    for (const compte of comptesCaisse) {
      const soldeInitialAgg = await this.agregerParCompte([compte.id], { lt: from });
      const { debit: debitInit, credit: creditInit } = soldeInitialAgg.get(compte.id) ?? { debit: 0, credit: 0 };
      const soldeInitial = debitInit - creditInit;

      const lignes = await this.prisma.journalLine.findMany({
        where: { accountId: compte.id, entry: { entryDate: { gte: from, lt: to } } },
        include: { entry: true },
        orderBy: { entry: { entryDate: "asc" } },
      });

      let solde = soldeInitial;
      const mouvements = lignes.map((l) => {
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        solde += debit - credit;
        return {
          date: l.entry.entryDate,
          label: l.label ?? l.entry.label,
          sourceType: l.entry.sourceType,
          debit,
          credit,
          soldeCumule: solde,
        };
      });

      comptes.push({
        code: compte.code,
        label: compte.label,
        soldeInitial,
        mouvements,
        soldeFinal: solde,
      });
    }

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      comptes,
    };
  }
}
