import { Module } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { DisputesController } from "./disputes.controller";
import { ShopsModule } from "../shops/shops.module";
import { OrdersModule } from "../orders/orders.module";

// OrdersModule importé pour OrdersService.transitionStatus (correctif audit
// du 16 oct. 2026 : resolve() ne faisait avancer QUE Dispute.status, jamais
// ShopOrder.status — une commande en litige restait bloquée sur DISPUTED
// indéfiniment même une fois le litige tranché).
@Module({
  imports: [ShopsModule, OrdersModule],
  providers: [DisputesService],
  controllers: [DisputesController],
})
export class DisputesModule {}
