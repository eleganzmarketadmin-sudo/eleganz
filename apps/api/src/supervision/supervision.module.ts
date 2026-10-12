import { Module } from "@nestjs/common";
import { SupervisionService } from "./supervision.service";
import { AdminSupervisionController } from "./admin-supervision.controller";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [SupervisionService],
  controllers: [AdminSupervisionController],
})
export class SupervisionModule {}
