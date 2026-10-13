import { Module } from "@nestjs/common";
import { ComptableService } from "./comptable.service";
import { ComptableBillingService } from "./comptable-billing.service";
import { ComptableExportService } from "./comptable-export.service";
import { ComptableController } from "./comptable.controller";
import { ComptableBillingController } from "./comptable-billing.controller";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";
import { AuthModule } from "../auth/auth.module";
import { FinanceModule } from "../finance/finance.module";

// ComptableController et ComptableBillingController utilisent
// @UseGuards(JwtAuthGuard), qui dépend de JwtService (fourni par JwtModule,
// importé/exporté par AuthModule) — sans cet import, Nest ne peut pas
// résoudre les dépendances de JwtAuthGuard au démarrage et TOUT le service
// plante (voir incident du 13 oct. 2026, docs/MAINTENANCE.md).
@Module({
  imports: [AdminSettingsModule, AuthModule, FinanceModule],
  providers: [ComptableService, ComptableBillingService, ComptableExportService],
  controllers: [ComptableController, ComptableBillingController],
  exports: [ComptableService, ComptableBillingService, ComptableExportService],
})
export class ComptableModule {}
