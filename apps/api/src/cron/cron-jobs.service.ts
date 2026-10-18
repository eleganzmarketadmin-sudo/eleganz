import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BillingService } from "../billing/billing.service";
import { DriverBillingService } from "../delivery/driver-billing.service";
import { ComptableBillingService } from "../comptable/comptable-billing.service";
import { EcheancierService } from "../echeancier/echeancier.service";

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

      const suspensions = await Promise.all([
        this.billing.suspendOverdueShops(),
        this.driverBilling.suspendOverdueDrivers(),
        this.comptableBilling.suspendOverdueSubscriptions(),
      ]);
      this.logger.log(`CRON_FACTURATION_SUSPENSIONS ${JSON.stringify(suspensions)}`);
    } catch (err) {
      // Une étape qui échoue ne doit jamais empêcher la prochaine exécution
      // quotidienne — le marqueur greppable permet de repérer l'incident
      // sans faire planter le planificateur lui-même (même principe que
      // ACCOUNTING_POSTING_FAILED ailleurs sur la plateforme).
      this.logger.error("CRON_FACTURATION_ECHEC le cycle de facturation quotidien a échoué", err);
    }
  }
}
