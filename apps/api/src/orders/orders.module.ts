import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { BuyerOrdersController } from "./buyer-orders.controller";
import { ShopOrdersController } from "./shop-orders.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [OrdersService],
  controllers: [BuyerOrdersController, ShopOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
