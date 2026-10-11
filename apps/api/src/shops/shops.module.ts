import { Module } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { ShopsController } from "./shops.controller";

@Module({
  providers: [ShopsService],
  controllers: [ShopsController],
  exports: [ShopsService],
})
export class ShopsModule {}
