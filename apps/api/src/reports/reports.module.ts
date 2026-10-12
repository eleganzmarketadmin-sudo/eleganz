import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { ShopsModule } from "../shops/shops.module";

@Module({
  imports: [ShopsModule],
  providers: [ReportsService],
  controllers: [ReportsController, AdminReportsController],
})
export class ReportsModule {}
