import { Module } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { DisputesController } from "./disputes.controller";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [DisputesService],
  controllers: [DisputesController],
})
export class DisputesModule {}
