import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { FiscalRuleScope } from "@eleganz/database";
import { construireClasseurExcelMultiFeuilles } from "../common/xlsx.util";

type Feuille = { nom: string; entetes: string[]; lignes: (string | number | null | undefined)[][] };

/**
 * Dossier de validation externe SYSCOHADA (chantier réactivé, phase 7 —
 * 14 oct. 2026) — la pièce de clôture du chantier : un classeur Excel à
 * plusieurs feuilles (plan comptable, journal, balance, bilan et compte de
 * résultat normalisés, plus une feuille "Présentation" qui porte
 * l'identité fiscale connue, la méthode retenue et ses limites) destiné à
 * être remis à un expert-comptable habilité pour validation ou
 * certification externe.
 *
 * Ce dossier ne fait QUE rassembler et mettre en forme des lectures déjà
 * existantes (AccountingQueryService.journal/balance/bilanNormalise/
 * compteDeResultatNormalise) — aucune nouvelle logique comptable, aucun
 * changement de schéma. Le "code de vérification" est une empreinte
 * SHA-256 des totaux calculés côté serveur (même convention que
 * ComptableExportService et ReportsService) : un repère anti-falsification
 * après génération, jamais une signature électronique ou une certification
 * au sens légal — ce point est redit explicitement dans la feuille
 * "Présentation" elle-même, pas seulement dans ce commentaire.
 */
@Injectable()
export class DossierValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
  ) {}

  private coderVerification(valeurs: (string | number)[]): string {
    return createHash("sha256").update(valeurs.join("|")).digest("hex").slice(0, 12).toUpperCase();
  }

  async genererClasseur(
    scope: FiscalRuleScope,
    shopId: string | null,
    from: Date,
    to: Date,
  ): Promise<{ buffer: Buffer; nomFichier: string }> {
    const asOf = to;

    const [identite, planComptable, journal, balance, bilan, compteResultat] = await Promise.all([
      scope === FiscalRuleScope.SHOP && shopId
        ? this.prisma.shop.findUnique({
            where: { id: shopId },
            select: {
              name: true,
              fiscalLegalName: true,
              fiscalLegalForm: true,
              fiscalIdNumber: true,
              fiscalAddress: true,
              fiscalJurisdiction: true,
              fiscalRegime: true,
              fiscalExercice: true,
              fiscalVatRegistered: true,
            },
          })
        : Promise.resolve(null),
      this.prisma.account.findMany({ where: { scope, shopId, active: true }, orderBy: { code: "asc" } }),
      this.accountingQuery.journal(scope, shopId, from, to),
      this.accountingQuery.balance(scope, shopId, from, to),
      this.accountingQuery.bilanNormalise(scope, shopId, asOf),
      this.accountingQuery.compteDeResultatNormalise(scope, shopId, from, to),
    ]);

    const genereLe = new Date().toISOString();
    const codeVerification = this.coderVerification([
      scope,
      shopId ?? "PLATFORM",
      from.toISOString(),
      to.toISOString(),
      balance.totalDebit,
      balance.totalCredit,
      bilan.totalActif,
      bilan.totalPassif,
      compteResultat.resultatNetAvantImpot,
      journal.length,
    ]);

    const feuilles: Feuille[] = [
      this.feuillePresentation(scope, identite, shopId, from, to, genereLe, codeVerification, journal.length),
      this.feuillePlanComptable(planComptable),
      this.feuilleJournal(journal),
      this.feuilleBalance(balance),
      this.feuilleBilan(bilan),
      this.feuilleCompteResultat(compteResultat),
    ];

    const buffer = construireClasseurExcelMultiFeuilles(feuilles);
    const suffixe = scope === FiscalRuleScope.SHOP ? "boutique" : "eleganz";
    const nomFichier = `dossier-validation-syscohada-${suffixe}-${to.toISOString().slice(0, 10)}.xlsx`;
    return { buffer, nomFichier };
  }

  private feuillePresentation(
    scope: FiscalRuleScope,
    identite: {
      name: string;
      fiscalLegalName: string | null;
      fiscalLegalForm: string | null;
      fiscalIdNumber: string | null;
      fiscalAddress: string | null;
      fiscalJurisdiction: string | null;
      fiscalRegime: string | null;
      fiscalExercice: string | null;
      fiscalVatRegistered: boolean | null;
    } | null,
    shopId: string | null,
    from: Date,
    to: Date,
    genereLe: string,
    codeVerification: string,
    nombreEcritures: number,
  ): Feuille {
    const lignes: (string | number | null)[][] = [
      ["Dossier", "Dossier de validation externe — Comptabilité SYSCOHADA"],
      [
        "Entité",
        scope === FiscalRuleScope.SHOP
          ? `Boutique ELEGANZ — ${identite?.fiscalLegalName || identite?.name || shopId}`
          : "ELEGANZ (plateforme — Centre de pilotage)",
      ],
    ];

    if (scope === FiscalRuleScope.SHOP) {
      lignes.push(
        ["Raison sociale", identite?.fiscalLegalName || "Non saisie"],
        ["Forme juridique", identite?.fiscalLegalForm || "Non saisie"],
        ["Identifiant fiscal", identite?.fiscalIdNumber || "Non saisi"],
        ["Adresse", identite?.fiscalAddress || "Non saisie"],
        ["Juridiction fiscale", identite?.fiscalJurisdiction || "Non saisie"],
        ["Régime fiscal", identite?.fiscalRegime || "Non saisi"],
        ["Exercice fiscal", identite?.fiscalExercice || "Non saisi"],
        ["Assujetti à la TVA", identite?.fiscalVatRegistered == null ? "Non précisé" : identite?.fiscalVatRegistered ? "Oui" : "Non"],
      );
    } else {
      lignes.push(["Identité fiscale", "Non saisie dans l'application à ce jour (aucun champ dédié à l'identité fiscale de la plateforme elle-même)."]);
    }

    lignes.push(
      ["", ""],
      ["Période couverte", `${from.toISOString().slice(0, 10)} au ${to.toISOString().slice(0, 10)}`],
      ["Nombre d'écritures sur la période", nombreEcritures],
      ["Généré le", genereLe],
      ["Code de vérification (SHA-256, 12 car.)", codeVerification],
      ["", ""],
      ["Méthode — plan comptable", "Plan comptable SYSCOHADA complet (classes 1 à 8), tenu en partie double ; chaque écriture équilibre débit = crédit (voir feuille 'Journal')."],
      ["Méthode — valorisation des stocks", "Coût Unitaire Moyen Pondéré (CUMP), recalculé à chaque réception valorisée. Une variante jamais réceptionnée n'a pas de coût connu et ses sorties ne sont pas valorisées (ni dans le CMV, ni ici)."],
      ["Méthode — trésorerie", "Chaque compte bancaire ou mobile money réel dispose de son propre sous-compte dédié (521-xx / 532-xx) — jamais un compte générique partagé."],
      ["Méthode — créances & dettes", "Lettrage par référence explicite à chaque règlement (pas de rapprochement automatique ligne à ligne) ; les relances sont journalisées, jamais envoyées automatiquement par SMS ou e-mail."],
      ["Limite — impôt sur les bénéfices", "Le compte de résultat normalisé (feuille correspondante) est présenté avant impôt sur les bénéfices : aucun compte de charge d'impôt sur le résultat n'est encore alimenté dans l'application."],
      ["Limite — clôture légale", "Les clôtures de période disponibles dans l'application verrouillent la saisie mais ne constituent pas une clôture d'exercice au sens réglementaire."],
      [
        "Limite — certification",
        "Ce dossier est une estimation de pilotage générée automatiquement à partir des opérations réellement enregistrées dans l'application. Il ne constitue ni une comptabilité certifiée, ni une liasse fiscale officielle. Seul un expert-comptable habilité peut établir et certifier les états financiers SYSCOHADA/OHADA définitifs.",
      ],
      [
        "Intégrité du document",
        "Le code de vérification ci-dessus est une empreinte des totaux calculés côté serveur au moment de la génération — un repère pour détecter une modification du fichier après coup, jamais une signature électronique ou une certification au sens légal.",
      ],
    );

    return { nom: "Présentation", entetes: ["Rubrique", "Détail"], lignes };
  }

  private feuillePlanComptable(comptes: { code: string; label: string; normalSide: string }[]): Feuille {
    return {
      nom: "Plan comptable",
      entetes: ["Code", "Libellé", "Sens normal", "Classe"],
      lignes: comptes.map((c) => [c.code, c.label, c.normalSide, c.code.charAt(0)]),
    };
  }

  private feuilleJournal(
    entrees: {
      entryDate: Date;
      label: string;
      journal: { code: string };
      lines: { account: { code: string; label: string }; debit: unknown; credit: unknown; label: string | null }[];
    }[],
  ): Feuille {
    const lignes: (string | number | null)[][] = [];
    for (const e of entrees) {
      for (const l of e.lines) {
        lignes.push([
          e.entryDate.toISOString().slice(0, 10),
          e.journal.code,
          l.label ?? e.label,
          l.account.code,
          l.account.label,
          Number(l.debit) || null,
          Number(l.credit) || null,
        ]);
      }
    }
    return { nom: "Journal", entetes: ["Date", "Journal", "Libellé", "Compte", "Libellé compte", "Débit", "Crédit"], lignes };
  }

  private feuilleBalance(balance: {
    comptes: { code: string; label: string; debit: number; credit: number; solde: number }[];
    totalDebit: number;
    totalCredit: number;
  }): Feuille {
    const lignes: (string | number | null)[][] = balance.comptes.map((c) => [c.code, c.label, c.debit, c.credit, c.solde]);
    lignes.push(["", "TOTAL", balance.totalDebit, balance.totalCredit, ""]);
    return { nom: "Balance", entetes: ["Code", "Libellé", "Débit", "Crédit", "Solde"], lignes };
  }

  private feuilleBilan(bilan: {
    actif: { immobilise: { code: string; label: string; montant: number }[]; circulant: { code: string; label: string; montant: number }[]; tresorerie: { code: string; label: string; montant: number }[] };
    passif: { capitauxPropres: { code: string; label: string; montant: number }[]; dettesFinancieres: { code: string; label: string; montant: number }[]; circulant: { code: string; label: string; montant: number }[] };
    totalActif: number;
    totalPassif: number;
    equilibre: boolean;
    asOf: string;
  }): Feuille {
    const lignes: (string | number | null)[][] = [["Bilan au", bilan.asOf.slice(0, 10), "", ""]];
    const rubrique = (nom: string, items: { code: string; label: string; montant: number }[]) => {
      for (const l of items) lignes.push([nom, l.code, l.label, l.montant]);
    };
    rubrique("ACTIF — Immobilisé", bilan.actif.immobilise);
    rubrique("ACTIF — Circulant", bilan.actif.circulant);
    rubrique("ACTIF — Trésorerie", bilan.actif.tresorerie);
    lignes.push(["", "", "TOTAL ACTIF", bilan.totalActif]);
    rubrique("PASSIF — Capitaux propres", bilan.passif.capitauxPropres);
    rubrique("PASSIF — Dettes financières", bilan.passif.dettesFinancieres);
    rubrique("PASSIF — Circulant", bilan.passif.circulant);
    lignes.push(["", "", "TOTAL PASSIF", bilan.totalPassif]);
    lignes.push(["", "", "Équilibré (actif = passif)", bilan.equilibre ? "Oui" : "Non — anomalie à signaler"]);
    return { nom: "Bilan normalisé", entetes: ["Rubrique", "Code", "Libellé", "Montant"], lignes };
  }

  private feuilleCompteResultat(cr: {
    exploitation: { produits: { code: string; label: string; montant: number }[]; charges: { code: string; label: string; montant: number }[]; resultat: number };
    financier: { produits: { code: string; label: string; montant: number }[]; charges: { code: string; label: string; montant: number }[]; resultat: number };
    resultatActivitesOrdinaires: number;
    hao: { produits: { code: string; label: string; montant: number }[]; charges: { code: string; label: string; montant: number }[]; resultat: number };
    resultatNetAvantImpot: number;
    statut: string;
  }): Feuille {
    const lignes: (string | number | null)[][] = [];
    const rubrique = (nom: string, items: { code: string; label: string; montant: number }[]) => {
      for (const l of items) lignes.push([nom, l.code, l.label, l.montant]);
    };
    rubrique("Exploitation — Produits", cr.exploitation.produits);
    rubrique("Exploitation — Charges", cr.exploitation.charges);
    lignes.push(["", "", "Résultat d'exploitation", cr.exploitation.resultat]);
    rubrique("Financier — Produits", cr.financier.produits);
    rubrique("Financier — Charges", cr.financier.charges);
    lignes.push(["", "", "Résultat financier", cr.financier.resultat]);
    lignes.push(["", "", "Résultat des activités ordinaires", cr.resultatActivitesOrdinaires]);
    rubrique("HAO — Produits", cr.hao.produits);
    rubrique("HAO — Charges", cr.hao.charges);
    lignes.push(["", "", "Résultat HAO", cr.hao.resultat]);
    lignes.push(["", "", "RÉSULTAT NET AVANT IMPÔT", cr.resultatNetAvantImpot]);
    lignes.push(["", "", "Statut", cr.statut]);
    return { nom: "Compte de résultat normalisé", entetes: ["Rubrique", "Code", "Libellé", "Montant"], lignes };
  }
}
