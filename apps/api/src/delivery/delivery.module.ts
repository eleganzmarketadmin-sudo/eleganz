import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { DeliveryController, AssignDriverController } from "./delivery.controller";
import { ShopsModule } from "../shops/shops.module";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [ShopsModule, OrdersModule],
  providers: [DeliveryService],
  controllers: [DeliveryController, AssignDriverController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
