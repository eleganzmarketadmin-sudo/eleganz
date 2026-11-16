import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { SubscriptionPlansController } from "./subscription-plans.controller";
import { ShopSubscriptionController } from "./shop-subscription.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../storage/storage.module";

// NotificationsModule (notifierMulticanal) et StorageModule
// (creerUrlUpload, preuves de paiement) ajoutés le 16 nov. 2026, chantier
// relances/recouvrement — voir BillingService.
@Module({
  imports: [ShopsModule, FinanceModule, NotificationsModule, StorageModule],
  providers: [BillingService, SubscriptionPlansService],
  controllers: [BillingController, SubscriptionPlansController, ShopSubscriptionController],
  exports: [BillingService, SubscriptionPlansService],
})
export class BillingModule {}
