import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { SubscriptionPlansController } from "./subscription-plans.controller";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [BillingService, SubscriptionPlansService],
  controllers: [BillingController, SubscriptionPlansController],
  exports: [BillingService, SubscriptionPlansService],
})
export class BillingModule {}
