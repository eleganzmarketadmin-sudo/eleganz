import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LoanStatut, ClassificationRisquePret } from "@eleganz/database";

export interface VentilationRisqueLigne {
  nombre: number;
  soldeRestant: number;
  provisionRequise: number;
}

export type VentilationRisque = Record<ClassificationRisquePret, VentilationRisqueLigne>;

export interface RapportPortefeuille {
  genereLe: string;
  capitalTotalEnCours: number;
  provisionRequiseTotal: number;
  nombrePretsActifs: number;
  nombrePretsTermines: number;
  ventilationRisque: VentilationRisque;
  // Purement informatif (voir commentaire sur rapport() ci-dessous) — null
  // plutôt que 0 quand aucun prêt actif n'existe, pour ne jamais laisser
  // croire à un portefeuille "sain à 0% de défaut" faute de données.
  tauxDefautCapital: number | null;
  tauxDefautNombre: number | null;
}

export interface ExpositionDemande {
  // null = candidature "libre" sans boutique ELEGANZ rattachée (voir
  // DemandeCreditService.creerLibre) : aucun encours shop par institution
  // n'est calculable dans ce cas, jamais remplacé par 0.
  encoursExistantShop: number | null;
  nombrePretsExistantsShop: number | null;
  encoursTotalPortefeuille: number;
  montantDemande: number;
  // Part du portefeuille APRÈS décaissement si ce montant est accordé
  // (encoursTotalPortefeuille + montantDemande au dénominateur) — jamais
  // une part du portefeuille actuel seul, qui sous-estimerait la
  // concentration réelle que cette décision créerait.
  partPortefeuilleSiAccorde: number | null;
}

const VENTILATION_VIDE = (): VentilationRisque => ({
  SAIN: { nombre: 0, soldeRestant: 0, provisionRequise: 0 },
  SOUS_SURVEILLANCE: { nombre: 0, soldeRestant: 0, provisionRequise: 0 },
  DOUTEUX: { nombre: 0, soldeRestant: 0, provisionRequise: 0 },
  COMPROMIS: { nombre: 0, soldeRestant: 0, provisionRequise: 0 },
});

/**
 * Rapport de portefeuille agrégé pour UNE institution (écran "Rapports", 19
 * nov. 2026, demande du propriétaire : "je ne vois pas un menu dédié aux
 * reports [...] utiles aux institutions financières et capitales dans
 * l'analyse crédit") — l'écran RAPPORTS existe déjà comme simple permission
 * de menu depuis le 16 nov. 2026 (voir MenuInstitution dans schema.prisma)
 * mais n'avait jusqu'ici ni écran ni endpoint (voir le commentaire
 * "Phase 2/3" dans InstitutionShell.tsx).
 *
 * Même logique d'agrégation que AdminCockpitService.executiveDashboard
 * (section institutionsRisque), mais filtrée à une seule institution et
 * exposée à l'institution elle-même plutôt qu'à l'admin ELEGANZ — ELEGANZ
 * Market reste un facilitateur, jamais une institution financière : cette
 * vue est purement informative, ELEGANZ n'impose ni ne bloque aucune
 * décision de risque à la place de l'institution (même principe que le
 * commentaire sur AdminCockpitService.institutionsRisque).
 */
@Injectable()
export class RapportPortefeuilleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Portée volontairement limitée aux prêts ACTIFS pour le capital/la
   * provision (exposition réelle actuelle). Le taux de défaut est lui
   * aussi calculé uniquement sur les prêts actifs — proportion déjà
   * classée COMPROMIS parmi l'encours actuel — et PAS un taux de défaut
   * "vie entière" du portefeuille : RisqueCreditService.calculerArrieresEtProvisions
   * ne reclasse que les prêts ACTIFS (voir le commentaire sur
   * Loan.classificationRisque dans schema.prisma), donc rien ne dit si un
   * prêt déjà TERMINE a un jour traversé COMPROMIS avant son solde à zéro —
   * inventer ce chiffre serait pire que ne pas l'afficher.
   */
  async rapport(institutionId: string): Promise<RapportPortefeuille> {
    const [ventilation, nombrePretsTermines] = await Promise.all([
      this.prisma.loan.groupBy({
        by: ["classificationRisque"],
        where: { institutionId, statut: LoanStatut.ACTIF },
        _count: { _all: true },
        _sum: { soldeRestant: true, provisionRequise: true },
      }),
      this.prisma.loan.count({ where: { institutionId, statut: LoanStatut.TERMINE } }),
    ]);

    const ventilationRisque = VENTILATION_VIDE();
    let capitalTotalEnCours = 0;
    let provisionRequiseTotal = 0;
    let nombrePretsActifs = 0;
    for (const ligne of ventilation) {
      const soldeRestant = Number(ligne._sum.soldeRestant ?? 0);
      const provisionRequise = Number(ligne._sum.provisionRequise ?? 0);
      ventilationRisque[ligne.classificationRisque] = { nombre: ligne._count._all, soldeRestant, provisionRequise };
      capitalTotalEnCours += soldeRestant;
      provisionRequiseTotal += provisionRequise;
      nombrePretsActifs += ligne._count._all;
    }

    const compromis = ventilationRisque.COMPROMIS;
    const tauxDefautCapital = capitalTotalEnCours > 0 ? compromis.soldeRestant / capitalTotalEnCours : null;
    const tauxDefautNombre = nombrePretsActifs > 0 ? compromis.nombre / nombrePretsActifs : null;

    return {
      genereLe: new Date().toISOString(),
      capitalTotalEnCours,
      provisionRequiseTotal,
      nombrePretsActifs,
      nombrePretsTermines,
      ventilationRisque,
      tauxDefautCapital,
      tauxDefautNombre,
    };
  }

  /**
   * Exposition de l'institution liée à UNE candidature de crédit (chantier
   * "menu Rapports", 19 nov. 2026, volet "capitales dans l'analyse crédit")
   * — vient compléter AnalyseCreditService.genererAnalyse (score 0-100 basé
   * uniquement sur les finances propres de la boutique demandeuse) avec le
   * contexte que ce score n'a jamais eu : l'exposition DÉJÀ engagée de
   * l'institution auprès de cette même boutique, et la part que cette
   * nouvelle demande représenterait dans son portefeuille si elle était
   * accordée. Volontairement tenu à l'écart du score lui-même (jamais
   * injecté dans calculerComposantes) — le score reste calculé seulement à
   * partir du dossier financier figé de la boutique, précisément pour
   * rester explicable à un régulateur indépendamment du reste du
   * portefeuille de l'institution (voir le commentaire sur
   * AnalyseCreditService). Cette exposition est à l'inverse une donnée
   * VIVANTE, jamais figée — recalculée à chaque consultation de l'écran,
   * contrairement au score.
   */
  async expositionPourDemande(institutionId: string, numero: string): Promise<ExpositionDemande> {
    const demande = await this.prisma.demandeCredit.findUnique({
      where: { numero },
      select: { institutionId: true, shopId: true, montantDemande: true },
    });
    if (!demande || demande.institutionId !== institutionId) {
      throw new NotFoundException("Demande de crédit introuvable.");
    }

    const [rapportPortefeuille, encoursShop] = await Promise.all([
      this.rapport(institutionId),
      demande.shopId
        ? this.prisma.loan.aggregate({
            where: { institutionId, shopId: demande.shopId, statut: LoanStatut.ACTIF },
            _sum: { soldeRestant: true },
            _count: { _all: true },
          })
        : Promise.resolve(null),
    ]);

    const montantDemande = Number(demande.montantDemande);
    const encoursTotalPortefeuille = rapportPortefeuille.capitalTotalEnCours;
    const encoursSiAccorde = encoursTotalPortefeuille + montantDemande;

    return {
      encoursExistantShop: encoursShop ? Number(encoursShop._sum.soldeRestant ?? 0) : null,
      nombrePretsExistantsShop: encoursShop ? encoursShop._count._all : null,
      encoursTotalPortefeuille,
      montantDemande,
      partPortefeuilleSiAccorde: encoursSiAccorde > 0 ? montantDemande / encoursSiAccorde : null,
    };
  }
}
