import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { DossierCreditBoutique } from "../finance/finance.service";
import { DemandeCreditStatut, NotationRisque, Prisma, StatutValidationAnalyse } from "@eleganz/database";
import { enregistrerAuditLog } from "../audit/audit-log.util";

interface Composante {
  label: string;
  // Ratio brut (ou nombre de mois pour l'ancienneté) — null si non
  // calculable, jamais une valeur inventée.
  valeur: number | null;
  points: number; // 0-25
  poids: number; // toujours 25 pour l'instant (4 composantes à poids égal)
  commentaire: string;
}

export interface ComposantesAnalyse {
  liquidite: Composante;
  endettement: Composante;
  rentabilite: Composante;
  anciennete: Composante;
}

const LIBELLES_NOTATION: Record<NotationRisque, string> = {
  [NotationRisque.TRES_FAIBLE]: "Risque très faible — profil financier solide sur les quatre composantes analysées.",
  [NotationRisque.FAIBLE]: "Risque faible — profil financier globalement sain.",
  [NotationRisque.MODERE]: "Risque modéré — profil acceptable, points de vigilance ci-dessous.",
  [NotationRisque.ELEVE]: "Risque élevé — plusieurs faiblesses identifiées, analyse approfondie recommandée avant toute décision.",
  [NotationRisque.TRES_ELEVE]: "Risque très élevé — profil financier fragile sur plusieurs composantes.",
};

/**
 * Analyse de crédit automatisée (chantier "gestion de risque autonome", 16
 * nov. 2026) — voir le commentaire détaillé sur AnalyseCredit dans
 * schema.prisma. Calcule un score 0-100 EXPLICABLE (4 composantes à poids
 * égal, chacune avec son ratio brut et son commentaire) à partir du seul
 * DemandeCredit.snapshotDossierCreditJson, jamais une relecture live ni un
 * modèle boîte noire : chaque institution doit pouvoir justifier la
 * notation devant son propre régulateur.
 *
 * Séparation analyste/décideur (demande du propriétaire, verrouillée le 16
 * nov. 2026) : cette classe ne fait QUE calculer/valider l'analyse, jamais
 * la décision finale (LoanDecision) — c'est InstitutionPortalService.decider
 * qui revérifie que le validateur de l'analyse diffère du décideur, juste
 * avant d'enregistrer le verdict.
 */
@Injectable()
export class AnalyseCreditService {
  constructor(private readonly prisma: PrismaService) {}

  private sommerRubrique(lignes: { montant: number }[]): number {
    return lignes.reduce((s, l) => s + l.montant, 0);
  }

  /**
   * 4 composantes à poids égal (25 points chacune) — volontairement simple
   * et documenté plutôt qu'un modèle statistique entraîné sur des données
   * qu'ELEGANZ n'a pas encore en volume suffisant. Chaque seuil est un choix
   * explicite, à ajuster si l'usage réel le justifie — jamais présenté comme
   * une vérité scientifique.
   */
  private calculerComposantes(snapshot: DossierCreditBoutique): ComposantesAnalyse {
    const { bilanNormalise, compteDeResultat, historiqueMensuel, boutiqueDepuis } = snapshot;

    // --- Liquidité : (actif circulant + trésorerie) / passif circulant ---
    const actifLiquide = this.sommerRubrique(bilanNormalise.actif.circulant) + this.sommerRubrique(bilanNormalise.actif.tresorerie);
    const passifCourant = this.sommerRubrique(bilanNormalise.passif.circulant);
    const ratioLiquidite = passifCourant > 0 ? actifLiquide / passifCourant : actifLiquide > 0 ? 3 : 1;
    let pointsLiquidite: number;
    if (ratioLiquidite >= 2) pointsLiquidite = 25;
    else if (ratioLiquidite >= 1.5) pointsLiquidite = 20;
    else if (ratioLiquidite >= 1) pointsLiquidite = 15;
    else if (ratioLiquidite >= 0.5) pointsLiquidite = 8;
    else pointsLiquidite = 0;

    // --- Endettement : dettes financières / capitaux propres -------------
    const dettesFinancieres = this.sommerRubrique(bilanNormalise.passif.dettesFinancieres);
    const capitauxPropres = this.sommerRubrique(bilanNormalise.passif.capitauxPropres);
    const ratioEndettement = capitauxPropres > 0 ? dettesFinancieres / capitauxPropres : dettesFinancieres > 0 ? 5 : 0;
    let pointsEndettement: number;
    if (ratioEndettement <= 0.5) pointsEndettement = 25;
    else if (ratioEndettement <= 1) pointsEndettement = 20;
    else if (ratioEndettement <= 2) pointsEndettement = 12;
    else if (ratioEndettement <= 3) pointsEndettement = 5;
    else pointsEndettement = 0;

    // --- Rentabilité : résultat net avant impôt / chiffre d'affaires cumulé
    const chiffreAffairesCumule = historiqueMensuel.reduce((s, m) => s + m.chiffreAffaires, 0);
    const margeNette =
      chiffreAffairesCumule > 0 ? compteDeResultat.resultatNetAvantImpot / chiffreAffairesCumule : compteDeResultat.resultatNetAvantImpot > 0 ? 0.2 : -1;
    let pointsRentabilite: number;
    if (margeNette >= 0.15) pointsRentabilite = 25;
    else if (margeNette >= 0.08) pointsRentabilite = 20;
    else if (margeNette >= 0.03) pointsRentabilite = 12;
    else if (margeNette >= 0) pointsRentabilite = 5;
    else pointsRentabilite = 0;

    // --- Ancienneté : mois écoulés depuis la création de la boutique -----
    const moisAnciennete = Math.max(0, Math.floor((Date.now() - new Date(boutiqueDepuis).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    let pointsAnciennete: number;
    if (moisAnciennete >= 36) pointsAnciennete = 25;
    else if (moisAnciennete >= 24) pointsAnciennete = 20;
    else if (moisAnciennete >= 12) pointsAnciennete = 14;
    else if (moisAnciennete >= 6) pointsAnciennete = 8;
    else pointsAnciennete = 2;

    return {
      liquidite: {
        label: "Liquidité",
        valeur: Math.round(ratioLiquidite * 100) / 100,
        points: pointsLiquidite,
        poids: 25,
        commentaire: `(Actif circulant + trésorerie) / passif circulant = ${ratioLiquidite.toFixed(2)}`,
      },
      endettement: {
        label: "Endettement",
        valeur: Math.round(ratioEndettement * 100) / 100,
        points: pointsEndettement,
        poids: 25,
        commentaire: `Dettes financières / capitaux propres = ${ratioEndettement.toFixed(2)}`,
      },
      rentabilite: {
        label: "Rentabilité",
        valeur: Math.round(margeNette * 10000) / 100,
        points: pointsRentabilite,
        poids: 25,
        commentaire: `Marge nette sur la période analysée = ${(margeNette * 100).toFixed(1)} %`,
      },
      anciennete: {
        label: "Ancienneté",
        valeur: moisAnciennete,
        points: pointsAnciennete,
        poids: 25,
        commentaire: `${moisAnciennete} mois d'activité ELEGANZ`,
      },
    };
  }

  private notationDepuisScore(score: number): NotationRisque {
    if (score >= 80) return NotationRisque.TRES_FAIBLE;
    if (score >= 60) return NotationRisque.FAIBLE;
    if (score >= 40) return NotationRisque.MODERE;
    if (score >= 20) return NotationRisque.ELEVE;
    return NotationRisque.TRES_ELEVE;
  }

  private construireRecommandation(notation: NotationRisque, composantes: ComposantesAnalyse): string {
    const alertes: string[] = [];
    if (composantes.liquidite.points <= 8) alertes.push("liquidité tendue");
    if (composantes.endettement.points <= 5) alertes.push("endettement élevé par rapport aux capitaux propres");
    if (composantes.rentabilite.points === 0) alertes.push("résultat net négatif ou nul sur la période");
    if (composantes.anciennete.points <= 2) alertes.push("activité ELEGANZ encore récente, historique limité");

    let texte = LIBELLES_NOTATION[notation];
    if (alertes.length > 0) {
      texte += ` Points d'attention : ${alertes.join(", ")}.`;
    }
    texte +=
      " Notation calculée automatiquement à partir des chiffres déclarés par la boutique sur ELEGANZ Gestion — elle ne remplace ni un audit, ni le jugement de l'analyste.";
    return texte;
  }

  /**
   * Calcule (ou recalcule) l'analyse d'une candidature. Un recalcul remet
   * TOUJOURS la validation à EN_ATTENTE (jamais une analyse "VALIDEE" sur
   * des chiffres qui viennent de changer) et incrémente recalculeCompteur.
   * Fait aussi avancer DemandeCredit.statut de RECUE à EN_ANALYSE la
   * première fois, jamais une resaisie manuelle.
   */
  async genererAnalyse(institutionId: string, numero: string) {
    const demande = await this.prisma.demandeCredit.findUnique({ where: { numero } });
    if (!demande || demande.institutionId !== institutionId) {
      throw new NotFoundException("Demande de crédit introuvable.");
    }

    const snapshot = demande.snapshotDossierCreditJson as unknown as DossierCreditBoutique | null;
    const existante = await this.prisma.analyseCredit.findUnique({ where: { demandeCreditId: demande.id } });

    let donnees: {
      analysable: boolean;
      scoreGlobal: number | null;
      notation: NotationRisque | null;
      // Prisma.JsonNull (jamais `null` nu) pour écrire explicitement un NULL
      // SQL sur une colonne Json — `null` seul n'est pas assignable à un
      // champ Json? côté types générés (TS2322 à la compilation sinon).
      composantes: object | typeof Prisma.JsonNull;
      recommandation: string;
      recalculeCompteur: number;
      statutValidation: StatutValidationAnalyse;
      valideParUserId: null;
      valideLe: null;
      noteValidation: null;
    };

    if (!snapshot) {
      // Candidature "libre" (DemandeCreditService.creerLibre) : aucun
      // snapshot ELEGANZ, donc aucun score automatique possible — voir le
      // commentaire sur AnalyseCredit.analysable dans schema.prisma.
      donnees = {
        analysable: false,
        scoreGlobal: null,
        notation: null,
        composantes: Prisma.JsonNull,
        recommandation:
          "Aucun dossier financier ELEGANZ rattaché à cette candidature (demande libre, prospect sans boutique ELEGANZ) : l'analyse automatique n'est pas calculable. Une revue manuelle complète est nécessaire avant toute décision.",
        recalculeCompteur: (existante?.recalculeCompteur ?? 0) + 1,
        statutValidation: StatutValidationAnalyse.EN_ATTENTE,
        valideParUserId: null,
        valideLe: null,
        noteValidation: null,
      };
    } else {
      const composantes = this.calculerComposantes(snapshot);
      const scoreGlobal = composantes.liquidite.points + composantes.endettement.points + composantes.rentabilite.points + composantes.anciennete.points;
      const notation = this.notationDepuisScore(scoreGlobal);
      donnees = {
        analysable: true,
        scoreGlobal,
        notation,
        composantes: composantes as unknown as object,
        recommandation: this.construireRecommandation(notation, composantes),
        recalculeCompteur: (existante?.recalculeCompteur ?? 0) + 1,
        statutValidation: StatutValidationAnalyse.EN_ATTENTE,
        valideParUserId: null,
        valideLe: null,
        noteValidation: null,
      };
    }

    const analyse = existante
      ? await this.prisma.analyseCredit.update({ where: { id: existante.id }, data: donnees })
      : await this.prisma.analyseCredit.create({ data: { demandeCreditId: demande.id, ...donnees } });

    if (demande.statut === DemandeCreditStatut.RECUE) {
      await this.prisma.demandeCredit.update({ where: { id: demande.id }, data: { statut: DemandeCreditStatut.EN_ANALYSE } });
    }

    return analyse;
  }

  async obtenirAnalyse(institutionId: string, numero: string) {
    const demande = await this.prisma.demandeCredit.findUnique({ where: { numero }, include: { analyse: true } });
    if (!demande || demande.institutionId !== institutionId) {
      throw new NotFoundException("Demande de crédit introuvable.");
    }
    return demande.analyse;
  }

  /**
   * Validation (ou rejet) par un analyste — AUCUNE vérification de rôle ici
   * (déjà posée par @InstitutionRoles sur la route), mais c'est bien CETTE
   * ligne (valideParUserId) que InstitutionPortalService.decider relit pour
   * appliquer la séparation analyste/décideur, jamais un simple contrôle de
   * rôle qui laisserait la même personne valider ET décider.
   */
  async validerAnalyse(institutionId: string, analyseId: string, userId: string, decision: "VALIDEE" | "REJETEE", note?: string) {
    const analyse = await this.prisma.analyseCredit.findUnique({ where: { id: analyseId }, include: { demandeCredit: true } });
    if (!analyse || analyse.demandeCredit.institutionId !== institutionId) {
      throw new NotFoundException("Analyse de crédit introuvable.");
    }
    if (!analyse.analysable) {
      throw new BadRequestException(
        "Cette candidature n'a pas d'analyse automatique à valider (dossier libre) — la décision peut être prise directement, après revue manuelle du dossier.",
      );
    }

    const misAJour = await this.prisma.analyseCredit.update({
      where: { id: analyseId },
      data: {
        statutValidation: decision === "VALIDEE" ? StatutValidationAnalyse.VALIDEE : StatutValidationAnalyse.REJETEE,
        valideParUserId: userId,
        valideLe: new Date(),
        noteValidation: note?.trim() || null,
      },
    });

    if (decision === "VALIDEE") {
      await this.prisma.demandeCredit.update({ where: { id: analyse.demandeCreditId }, data: { statut: DemandeCreditStatut.EN_DECISION } });
    }

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: userId,
      action: "ANALYSE_CREDIT_VALIDATION",
      details: { analyseId, institutionId, decision, note: note?.trim() || null },
    });

    return misAJour;
  }
}
