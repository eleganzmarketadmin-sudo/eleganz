import { Module } from "@nestjs/common";
import { PosService } from "./pos.service";
import { PosController } from "./pos.controller";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [PosService],
  controllers: [PosController],
  exports: [PosService],
})
export class PosModule {}
