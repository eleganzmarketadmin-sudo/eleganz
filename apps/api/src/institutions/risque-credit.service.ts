import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ClassificationRisquePret, LoanStatut } from "@eleganz/database";

/**
 * Classification du risque et provisionnement des prêts décaissés via le
 * portail Institutions (chantier "gestion de risque autonome", 16 nov.
 * 2026) — jusqu'ici, un prêt en retard n'était détectable qu'en comparant
 * manuellement les échéances comptabilisées à l'échéancier théorique,
 * aucun indicateur ni aucune provision n'existait nulle part.
 *
 * Portée volontairement limitée aux prêts `institutionId` non nul : un
 * prêt obtenu directement par la boutique/l'admin, sans institution
 * partenaire (scope=PLATFORM ou boutique sans décision), n'a pas de
 * `prochainEcheanceAttendueLe` (voir LoansService.obtenirPret, qui ne le
 * pose jamais) — il est donc naturellement ignoré ci-dessous, jamais un
 * filtre supplémentaire à maintenir.
 *
 * Seule source de vérité : `Loan.prochainEcheanceAttendueLe`, posée au
 * décaissement et avancée à chaque échéance comptabilisée (LoansService).
 * Ce service ne fait QUE lire cette date et la comparer à aujourd'hui —
 * jamais un recalcul d'échéancier théorique, qui diverge trop vite d'un
 * remboursement anticipé ou en retard.
 */
@Injectable()
export class RisqueCreditService {
  private readonly logger = new Logger(RisqueCreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private classifier(joursRetard: number, seuils: { sousSurveillance: number; douteux: number; compromis: number }): ClassificationRisquePret {
    if (joursRetard >= seuils.compromis) return ClassificationRisquePret.COMPROMIS;
    if (joursRetard >= seuils.douteux) return ClassificationRisquePret.DOUTEUX;
    if (joursRetard >= seuils.sousSurveillance) return ClassificationRisquePret.SOUS_SURVEILLANCE;
    return ClassificationRisquePret.SAIN;
  }

  private tauxProvision(
    classification: ClassificationRisquePret,
    taux: { sousSurveillance: number; douteux: number; compromis: number },
  ): number {
    switch (classification) {
      case ClassificationRisquePret.SOUS_SURVEILLANCE:
        return taux.sousSurveillance;
      case ClassificationRisquePret.DOUTEUX:
        return taux.douteux;
      case ClassificationRisquePret.COMPROMIS:
        return taux.compromis;
      default:
        // SAIN : jamais configurable, voir le commentaire sur
        // PlatformSettings.risqueTauxProvision* dans schema.prisma — un prêt
        // à jour n'a par définition aucune perte attendue à provisionner.
        return 0;
    }
  }

  /**
   * Tourne une fois par jour (voir CronJobsService) — aussi déclenchable
   * manuellement si besoin. Traite chaque prêt ACTIF rattaché à une
   * institution indépendamment des autres : l'échec d'un prêt ne doit
   * jamais empêcher le reclassement des suivants.
   */
  async calculerArrieresEtProvisions() {
    const reglages = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: {
        risqueJoursSousSurveillance: true,
        risqueJoursDouteux: true,
        risqueJoursCompromis: true,
        risqueTauxProvisionSousSurveillance: true,
        risqueTauxProvisionDouteux: true,
        risqueTauxProvisionCompromis: true,
      },
    });
    const seuils = {
      sousSurveillance: reglages?.risqueJoursSousSurveillance ?? 30,
      douteux: reglages?.risqueJoursDouteux ?? 90,
      compromis: reglages?.risqueJoursCompromis ?? 180,
    };
    const taux = {
      sousSurveillance: reglages ? Number(reglages.risqueTauxProvisionSousSurveillance) : 10,
      douteux: reglages ? Number(reglages.risqueTauxProvisionDouteux) : 50,
      compromis: reglages ? Number(reglages.risqueTauxProvisionCompromis) : 100,
    };

    const prets = await this.prisma.loan.findMany({
      where: { institutionId: { not: null }, statut: LoanStatut.ACTIF, prochainEcheanceAttendueLe: { not: null } },
      select: { id: true, prochainEcheanceAttendueLe: true, soldeRestant: true },
    });

    const maintenant = Date.now();
    let traites = 0;
    let enRetard = 0;
    const parClassification: Record<string, number> = { SAIN: 0, SOUS_SURVEILLANCE: 0, DOUTEUX: 0, COMPROMIS: 0 };

    for (const pret of prets) {
      try {
        const joursRetard = Math.max(0, Math.floor((maintenant - pret.prochainEcheanceAttendueLe!.getTime()) / (1000 * 60 * 60 * 24)));
        const classification = this.classifier(joursRetard, seuils);
        const tauxApplicable = this.tauxProvision(classification, taux);
        const provisionRequise = Math.round(Number(pret.soldeRestant) * (tauxApplicable / 100) * 100) / 100;

        await this.prisma.loan.update({
          where: { id: pret.id },
          data: { joursRetardActuel: joursRetard, classificationRisque: classification, provisionRequise },
        });

        traites++;
        if (joursRetard > 0) enRetard++;
        parClassification[classification]++;
      } catch (err) {
        this.logger.error(`RISQUE_CREDIT_ECHEC_PRET échec du reclassement du prêt ${pret.id}`, err);
      }
    }

    return { traites, enRetard, parClassification };
  }
}
