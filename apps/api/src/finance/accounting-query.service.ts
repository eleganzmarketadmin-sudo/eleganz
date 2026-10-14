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

  /**
   * Bilan SYSCOHADA normalisé (chantier SYSCOHADA, phase 6 — 14 oct. 2026) —
   * regroupe les comptes existants dans les rubriques du bilan système
   * normal (actif immobilisé / circulant / trésorerie ; capitaux propres /
   * dettes financières / passif circulant), plutôt que la liste plate déjà
   * produite par `bilan()` ci-dessus (conservée inchangée, toujours utilisée
   * ailleurs). Chaque rubrique n'affiche que les comptes qui existent
   * réellement pour ce scope — jamais une ligne à 0 ajoutée "pour faire
   * complet". Reste un état de PILOTAGE, pas un document certifié : voir le
   * bandeau affiché par l'écran qui l'utilise.
   */
  async bilanNormalise(scope: FiscalRuleScope, shopId: string | null, asOf: Date) {
    const ligne = async (code: string, label: string) => ({
      code,
      label,
      montant: await this.soldeCompte(scope, shopId, code, { lt: asOf }),
    });
    const netImmo = async (codeActif: string, codeAmort: string, label: string) => {
      const brut = await this.soldeCompte(scope, shopId, codeActif, { lt: asOf });
      const amort = await this.soldeCompte(scope, shopId, codeAmort, { lt: asOf });
      return { code: codeActif, label, montant: brut - amort };
    };
    // Générique (<T extends {montant}>), pas `(lignes: {montant:number}[])` :
    // avec un paramètre non générique, `.filter()` renvoie le type DÉCLARÉ du
    // paramètre, pas le type réel des éléments passés — ici ça aurait
    // silencieusement élargi chaque ligne à `{montant:number}` seul, perdant
    // `code`/`label` du type statique inféré de cette méthode (le JSON à
    // l'exécution reste correct, seul le type TypeScript se trompe). Bug
    // trouvé en vérification avant déploiement de dossier-validation.service.ts
    // (chantier SYSCOHADA phase 7, 14 oct. 2026), qui est le premier
    // consommateur à dépendre statiquement de `code`/`label` ici.
    const nonVide = <T extends { montant: number }>(lignes: T[]) => lignes.filter((l) => Math.abs(l.montant) > 0.004);

    const actifImmobilise = nonVide([
      await netImmo("211", "2811", "Immobilisations incorporelles (net)"),
      await netImmo("2441", "2841", "Matériel et mobilier de bureau (net)"),
      await netImmo("2181", "2818", "Agencements et installations (net)"),
    ]);
    const actifCirculant = nonVide([
      await ligne("311", "Marchandises (stock)"),
      await ligne("411", "Clients (dont créances Marketplace)"),
      await ligne("409", "Fournisseurs débiteurs (avances versées)"),
      await ligne("445", "État — TVA récupérable"),
    ]);
    const tresorerieActif = nonVide(
      await Promise.all(
        (
          await this.prisma.account.findMany({
            where: {
              scope,
              shopId,
              active: true,
              OR: [{ code: { in: ["5711", "5712"] } }, { code: { startsWith: "521" } }, { code: { startsWith: "532" } }],
            },
          })
        ).map((c) => ligne(c.code, c.label)),
      ),
    );

    const capitauxPropres = nonVide([
      await ligne("101", "Capital social"),
      await ligne("106", "Réserves"),
      await ligne("110", "Report à nouveau"),
      { code: "RESULT", label: "Résultat net de l'exercice", montant: await this.resultatNetCumule(scope, shopId, asOf) },
    ]);
    const dettesFinancieres = nonVide([await ligne("162", "Emprunts auprès des établissements de crédit")]);
    const passifCirculant = nonVide([
      await ligne("401", "Fournisseurs"),
      await ligne("419", "Clients créditeurs (avances reçues)"),
      await ligne("421", "Personnel — rémunérations dues"),
      await ligne("431", "Sécurité sociale"),
      await ligne("441", "État — impôts sur les bénéfices"),
      await ligne("443", "État — TVA facturée"),
      await ligne("447", "État — autres impôts et taxes"),
    ]);

    const totalActif =
      actifImmobilise.reduce((s, l) => s + l.montant, 0) +
      actifCirculant.reduce((s, l) => s + l.montant, 0) +
      tresorerieActif.reduce((s, l) => s + l.montant, 0);
    const totalPassif =
      capitauxPropres.reduce((s, l) => s + l.montant, 0) +
      dettesFinancieres.reduce((s, l) => s + l.montant, 0) +
      passifCirculant.reduce((s, l) => s + l.montant, 0);

    return {
      asOf: asOf.toISOString(),
      actif: { immobilise: actifImmobilise, circulant: actifCirculant, tresorerie: tresorerieActif },
      passif: { capitauxPropres, dettesFinancieres, circulant: passifCirculant },
      totalActif: Math.round(totalActif * 100) / 100,
      totalPassif: Math.round(totalPassif * 100) / 100,
      equilibre: Math.abs(totalActif - totalPassif) < 0.01,
    };
  }

  private async resultatNetCumule(scope: FiscalRuleScope, shopId: string | null, asOf: Date): Promise<number> {
    const comptes = await this.prisma.account.findMany({
      where: { scope, shopId, active: true, OR: [{ code: { startsWith: "6" } }, { code: { startsWith: "7" } }] },
    });
    const agg = await this.agregerParCompte(comptes.map((c) => c.id), { lt: asOf });
    let resultatNet = 0;
    for (const compte of comptes) {
      const { debit, credit } = agg.get(compte.id) ?? { debit: 0, credit: 0 };
      resultatNet += compte.code.startsWith("7") ? credit - debit : -(debit - credit);
    }
    return resultatNet;
  }

  /**
   * Compte de résultat SYSCOHADA normalisé (chantier SYSCOHADA, phase 6) —
   * regroupe charges et produits par rubrique réglementaire (exploitation /
   * financier / HAO) et calcule les soldes intermédiaires de gestion
   * (résultat d'exploitation, résultat financier, résultat des activités
   * ordinaires, résultat HAO). N'inclut PAS de ligne "impôt sur les
   * bénéfices" : aucun compte de charge d'impôt sur le résultat n'est seedé
   * à ce jour (voir docs) — le résultat net ci-dessous est donc explicitement
   * "avant impôt sur les bénéfices", jamais présenté comme un résultat net
   * fiscal final.
   */
  async compteDeResultatNormalise(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    // `soldeCompte` renvoie déjà un montant positif pour un compte de charge
    // (normalSide DEBIT, debit-credit) — même convention que l'ancien
    // `compteDeResultat()` ci-dessus, où les lignes de charges sont
    // affichées positives et `resultatNet = produits - charges`. Négliger ce
    // point ici (bug corrigé avant tout déploiement, 14 oct. 2026) aurait
    // transformé chaque soustraction de charge en addition et inversé le
    // signe du résultat.
    const montantCharge = async (code: string) => await this.soldeCompte(scope, shopId, code, { gte: from, lt: to });
    const montantProduit = async (code: string) => await this.soldeCompte(scope, shopId, code, { gte: from, lt: to });
    // Générique — même raison que dans bilanNormalise ci-dessus : préserve
    // `code`/`label` dans le type statique inféré du résultat.
    const nonVide = <T extends { montant: number }>(lignes: T[]) => lignes.filter((l) => Math.abs(l.montant) > 0.004);
    const l = (code: string, label: string, montant: number) => ({ code, label, montant });

    const produitsExploitation = nonVide([
      l("701", "Ventes de marchandises (caisse)", await montantProduit("701")),
      l("7012", "Ventes Marketplace", await montantProduit("7012")),
      l("706", "Produits accessoires", await montantProduit("706")),
      l("758", "Produits divers", await montantProduit("758")),
    ]);
    const chargesExploitation = nonVide([
      l("601", "Achats de marchandises", await montantCharge("601")),
      l("605", "Autres achats", await montantCharge("605")),
      l("603", "Variation de stocks (CMV)", await montantCharge("603")),
      l("6220", "Charges de fonctionnement", await montantCharge("6220")),
      l("6221", "Charges administratives", await montantCharge("6221")),
      l("6222", "Charges commerciales", await montantCharge("6222")),
      l("622", "Locations", await montantCharge("622")),
      l("624", "Entretien et réparations", await montantCharge("624")),
      l("628", "Divers — services extérieurs", await montantCharge("628")),
      l("661", "Charges de personnel", await montantCharge("661")),
      l("664", "Charges sociales", await montantCharge("664")),
      l("641", "Impôts et taxes", await montantCharge("641")),
      l("681", "Dotations aux amortissements", await montantCharge("681")),
    ]);
    // Tableau vide explicitement typé — un littéral `[]` seul ferait inférer
    // `T = never` au generic `nonVide` ci-dessus (aucun élément pour le
    // déduire), ce qui aurait cassé la compilation sur `l.montant` dans le
    // corps de `nonVide`. Ce compte n'est simplement pas encore seedé.
    const produitsFinanciers = nonVide<ReturnType<typeof l>>([]);
    const chargesFinancieres = nonVide([l("671", "Charges financières", await montantCharge("671"))]);
    const produitsHAO = nonVide([l("841", "Produits HAO", await montantProduit("841"))]);
    const chargesHAO = nonVide([l("831", "Charges HAO", await montantCharge("831"))]);

    const totalProduitsExploitation = produitsExploitation.reduce((s, x) => s + x.montant, 0);
    const totalChargesExploitation = chargesExploitation.reduce((s, x) => s + x.montant, 0);
    const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;

    const totalProduitsFinanciers = produitsFinanciers.reduce((s, x) => s + x.montant, 0);
    const totalChargesFinancieres = chargesFinancieres.reduce((s, x) => s + x.montant, 0);
    const resultatFinancier = totalProduitsFinanciers - totalChargesFinancieres;

    const resultatActivitesOrdinaires = resultatExploitation + resultatFinancier;

    const totalProduitsHAO = produitsHAO.reduce((s, x) => s + x.montant, 0);
    const totalChargesHAO = chargesHAO.reduce((s, x) => s + x.montant, 0);
    const resultatHAO = totalProduitsHAO - totalChargesHAO;

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      exploitation: { produits: produitsExploitation, charges: chargesExploitation, resultat: resultatExploitation },
      financier: { produits: produitsFinanciers, charges: chargesFinancieres, resultat: resultatFinancier },
      resultatActivitesOrdinaires,
      hao: { produits: produitsHAO, charges: chargesHAO, resultat: resultatHAO },
      resultatNetAvantImpot: resultatActivitesOrdinaires + resultatHAO,
      statut: "Résultat avant impôt sur les bénéfices — aucun compte de charge d'impôt sur le résultat n'est encore tenu.",
    };
  }

  /**
   * Solde d'un seul compte (signé selon son `normalSide`), sur une période ou
   * cumulé depuis l'origine (`{lt: asOf}`) — brique commune à `bilan` et à
   * toute lecture ponctuelle d'un compte (ex. tableau de bord boutique) qui
   * n'a pas besoin d'un relevé complet. Retourne 0 si le compte n'existe pas
   * encore (plan comptable seedé à la première écriture de la boutique, voir
   * AccountingSeedService).
   */
  async soldeCompte(
    scope: FiscalRuleScope,
    shopId: string | null,
    code: string,
    periode: { lt: Date } | { gte: Date; lt: Date },
  ): Promise<number> {
    const compte = await this.prisma.account.findFirst({ where: { scope, shopId, code } });
    if (!compte) return 0;
    const agg = await this.agregerParCompte([compte.id], periode);
    const { debit, credit } = agg.get(compte.id) ?? { debit: 0, credit: 0 };
    return compte.normalSide === "DEBIT" ? debit - credit : credit - debit;
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
    // Depuis le 14 oct. 2026 (chantier SYSCOHADA, phase 2) : inclut aussi les
    // sous-comptes banque (521-xx) et mobile money (532-xx) créés par
    // TresorerieComptesService, en plus des deux caisses historiques — un
    // compte de ce type n'apparaît ici que s'il existe réellement, jamais une
    // ligne vide ajoutée "pour faire complet".
    const comptesCaisse = await this.prisma.account.findMany({
      where: {
        scope,
        shopId,
        active: true,
        OR: [{ code: { in: ["5711", "5712"] } }, { code: { startsWith: "521" } }, { code: { startsWith: "532" } }],
      },
      orderBy: { code: "asc" },
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
