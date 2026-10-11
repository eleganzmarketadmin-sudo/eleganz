import { Module } from "@nestjs/common";
import { AdminCockpitService } from "./admin-cockpit.service";
import { AdminCockpitController } from "./admin-cockpit.controller";

@Module({
  providers: [AdminCockpitService],
  controllers: [AdminCockpitController],
})
export class AdminCockpitModule {}
