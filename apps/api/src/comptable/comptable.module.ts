import { Module } from "@nestjs/common";
import { ComptableService } from "./comptable.service";
import { ComptableBillingService } from "./comptable-billing.service";
import { ComptableController } from "./comptable.controller";
import { ComptableBillingController } from "./comptable-billing.controller";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";

@Module({
  imports: [AdminSettingsModule],
  providers: [ComptableService, ComptableBillingService],
  controllers: [ComptableController, ComptableBillingController],
  exports: [ComptableService, ComptableBillingService],
})
export class ComptableModule {}
