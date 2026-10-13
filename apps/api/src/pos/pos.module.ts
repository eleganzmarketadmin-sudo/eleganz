import { Module } from "@nestjs/common";
import { PosService } from "./pos.service";
import { PosController } from "./pos.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [PosService],
  controllers: [PosController],
  exports: [PosService],
})
export class PosModule {}
