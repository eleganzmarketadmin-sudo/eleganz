import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BillingService } from "../billing/billing.service";
import { DriverBillingService } from "../delivery/driver-billing.service";
import { ComptableBillingService } from "../comptable/comptable-billing.service";
import { EcheancierService } from "../echeancier/echeancier.service";
import { RisqueCreditService } from "../institutions/risque-credit.service";
import { BoostService } from "../boost/boost.service";
import { BoostExterneService } from "../boost-externe/boost-externe.service";

/**
 * Automatisation du cycle de facturation (18 oct. 2026, point 6 de l'audit
 * du 17 oct. 2026 — jusqu'ici, chaque étape ci-dessous ne tournait que si un
 * administrateur cliquait manuellement sur l'écran Tarifs/Comptable/Factures,
 * ce qui veut dire qu'un compte en retard pouvait rester actif indéfiniment
 * si personne n'y pensait un jour donné).
 *
 * Tourne une fois par jour, à 3h du matin (heure serveur) — après les heures
 * d'activité habituelles de la boutique/du livreur, et avant le début de la
 * journée suivante. Ordre délibéré :
 *   1. Expirations de période gratuite → fait passer en PAYMENT_DUE et
 *      génère la facture d'ouverture correspondante (boutique, livreur,
 *      Secourable) — doit tourner AVANT l'échéancier pour que la toute
 *      nouvelle facture soit déjà prise en compte dans les relances du jour.
 *   2. Facturation récurrente (mensuelle / renouvellement / commission).
 *   3. Échéancier (relances J-3 → retard, boutique/livreur/Secourable +
 *      dettes comptable déjà couvertes) — c'est l'alerte demandée AVANT
 *      suspension : elle tourne tous les jours dans la fenêtre J-3→retard,
 *      largement avant que le délai de grâce (7 à 14 jours après l'échéance,
 *      selon le module) n'expire à l'étape suivante.
 *   4. Suspensions pour impayé — en dernier, une fois que les relances ont
 *      eu leur chance d'aboutir à un paiement.
 *   5. Expiration des boosts payants (26 nov. 2026) — purement cosmétique/
 *      historique (voir BoostService.expirerBoostsTermines) : placée en toute
 *      fin, sans lien de dépendance avec les étapes de facturation
 *      ci-dessus, le tri du catalogue ne se fiant jamais à ce `status` seul
 *      mais toujours à `endsAt` comparé à l'instant présent.
 *
 * Chaque étape reste aussi déclenchable manuellement depuis les écrans admin
 * existants (POST /admin/.../run-...) — ce cron ne les remplace pas, il
 * couvre simplement le jour où personne ne clique.
 */
@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly driverBilling: DriverBillingService,
    private readonly comptableBilling: ComptableBillingService,
    private readonly echeancier: EcheancierService,
    private readonly risqueCredit: RisqueCreditService,
    private readonly boost: BoostService,
    private readonly boostExterne: BoostExterneService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "cycle-facturation-quotidien" })
  async executerCycleFacturationQuotidien() {
    this.logger.log("CRON_FACTURATION_DEBUT démarrage du cycle de facturation quotidien");
    try {
      const expirations = await Promise.all([
        this.billing.processTrialExpirations(),
        this.driverBilling.processTrialExpirations(),
        this.comptableBilling.processTrialExpirations(),
      ]);
      this.logger.log(`CRON_FACTURATION_EXPIRATIONS ${JSON.stringify(expirations)}`);

      const facturationRecurrente = await Promise.all([
        this.billing.runMonthlyBilling(),
        this.billing.runCommissionBilling(),
        this.driverBilling.runMonthlyBilling(),
        this.comptableBilling.runRenewalBilling(),
      ]);
      this.logger.log(`CRON_FACTURATION_RECURRENTE ${JSON.stringify(facturationRecurrente)}`);

      const relances = await this.echeancier.run();
      this.logger.log(`CRON_FACTURATION_RELANCES ${JSON.stringify(relances)}`);

      // suspendOverdueShops/Drivers/Subscriptions ont été remplacées le
      // 16 nov. 2026 (chantier relances/recouvrement) par les trois
      // executerEscaladeFactures..., qui font à la fois les relances
      // numérotées (avec mémoire du palier déjà atteint) ET la suspension —
      // voir BillingService.executerEscaladeFacturesBoutiques pour le motif
      // commun, répliqué à l'identique sur DriverBillingService/
      // ComptableBillingService.
      const suspensions = await Promise.all([
        this.billing.executerEscaladeFacturesBoutiques(),
        this.driverBilling.executerEscaladeFacturesLivreurs(),
        this.comptableBilling.executerEscaladeFacturesComptable(),
      ]);
      this.logger.log(`CRON_FACTURATION_SUSPENSIONS ${JSON.stringify(suspensions)}`);

      const boostsExpires = await this.boost.expirerBoostsTermines();
      this.logger.log(`CRON_FACTURATION_BOOSTS_EXPIRES ${JSON.stringify(boostsExpires)}`);
    } catch (err) {
      // Une étape qui échoue ne doit jamais empêcher la prochaine exécution
      // quotidienne — le marqueur greppable permet de repérer l'incident
      // sans faire planter le planificateur lui-même (même principe que
      // ACCOUNTING_POSTING_FAILED ailleurs sur la plateforme).
      this.logger.error("CRON_FACTURATION_ECHEC le cycle de facturation quotidien a échoué", err);
    }
  }

  /**
   * Reclassement quotidien du risque de crédit des prêts décaissés via le
   * portail Institutions (chantier "gestion de risque autonome", 16 nov.
   * 2026) — après le cycle de facturation ci-dessus plutôt qu'avant : sans
   * lien entre les deux (un prêt décaissé par une institution n'entre jamais
   * dans la facturation ELEGANZ), l'ordre n'a pas d'importance fonctionnelle,
   * seulement une convention de lisibilité (facturation d'abord, risque de
   * crédit ensuite).
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: "risque-credit-quotidien" })
  async executerReclassementRisqueCredit() {
    this.logger.log("CRON_RISQUE_CREDIT_DEBUT démarrage du reclassement quotidien du risque de crédit");
    try {
      const resultat = await this.risqueCredit.calculerArrieresEtProvisions();
      this.logger.log(`CRON_RISQUE_CREDIT_FIN ${JSON.stringify(resultat)}`);
    } catch (err) {
      this.logger.error("CRON_RISQUE_CREDIT_ECHEC le reclassement quotidien du risque de crédit a échoué", err);
    }
  }

  /**
   * Synchronisation ELEGANZ BOOST 360° (27 nov. 2026) — statut d'approbation
   * et statistiques des campagnes réellement transmises aux réseaux
   * publicitaires externes, plus détection des connexions OAuth expirées.
   * Toutes les 2h (pas quotidien comme le reste du cycle) : une campagne
   * publicitaire peut passer en revue puis démarrer à diffuser en quelques
   * heures seulement, contrairement aux cycles de facturation qui n'ont
   * aucune urgence à l'échelle de la journée.
   */
  @Cron(CronExpression.EVERY_2_HOURS, { name: "boost-externe-synchronisation" })
  async executerSynchronisationBoostExterne() {
    this.logger.log("CRON_BOOST_EXTERNE_DEBUT démarrage de la synchronisation Boost 360°");
    try {
      const resultat = await this.boostExterne.synchroniserStatutsEtStatistiques();
      this.logger.log(`CRON_BOOST_EXTERNE_FIN ${JSON.stringify(resultat)}`);
    } catch (err) {
      this.logger.error("CRON_BOOST_EXTERNE_ECHEC la synchronisation Boost 360° a échoué", err);
    }
  }
}
