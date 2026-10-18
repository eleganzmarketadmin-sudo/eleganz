import { Module } from "@nestjs/common";
import { CronJobsService } from "./cron-jobs.service";
import { BillingModule } from "../billing/billing.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { ComptableModule } from "../comptable/comptable.module";
import { EcheancierModule } from "../echeancier/echeancier.module";

// ScheduleModule.forRoot() est enregistré une seule fois, au niveau
// AppModule (voir app.module.ts) — c'est lui qui active globalement le
// mécanisme @Cron ; ce module-ci ne fait qu'assembler les dépendances dont
// CronJobsService a besoin pour appeler les services de facturation déjà
// existants.
@Module({
  imports: [BillingModule, DeliveryModule, ComptableModule, EcheancierModule],
  providers: [CronJobsService],
})
export class CronModule {}
