import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { DriverBillingService } from "./driver-billing.service";
import { DeliveryController, AssignDriverController, ShopDriverNetworkController } from "./delivery.controller";
import { DriverBillingController } from "./driver-billing.controller";
import { ShopsModule } from "../shops/shops.module";
import { OrdersModule } from "../orders/orders.module";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [ShopsModule, OrdersModule, AdminSettingsModule, FinanceModule, NotificationsModule, StorageModule],
  providers: [DeliveryService, DriverBillingService],
  controllers: [DeliveryController, AssignDriverController, ShopDriverNetworkController, DriverBillingController],
  exports: [DeliveryService, DriverBillingService],
})
export class DeliveryModule {}
