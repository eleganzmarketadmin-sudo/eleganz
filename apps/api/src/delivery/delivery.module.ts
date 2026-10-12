import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { DriverBillingService } from "./driver-billing.service";
import { DeliveryController, AssignDriverController } from "./delivery.controller";
import { DriverBillingController } from "./driver-billing.controller";
import { ShopsModule } from "../shops/shops.module";
import { OrdersModule } from "../orders/orders.module";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";

@Module({
  imports: [ShopsModule, OrdersModule, AdminSettingsModule],
  providers: [DeliveryService, DriverBillingService],
  controllers: [DeliveryController, AssignDriverController, DriverBillingController],
  exports: [DeliveryService, DriverBillingService],
})
export class DeliveryModule {}
