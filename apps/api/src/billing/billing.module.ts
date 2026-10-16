import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { SubscriptionPlansController } from "./subscription-plans.controller";
import { ShopSubscriptionController } from "./shop-subscription.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [BillingService, SubscriptionPlansService],
  controllers: [BillingController, SubscriptionPlansController, ShopSubscriptionController],
  exports: [BillingService, SubscriptionPlansService],
})
export class BillingModule {}
