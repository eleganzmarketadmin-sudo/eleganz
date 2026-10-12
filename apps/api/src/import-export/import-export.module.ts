import { Module } from "@nestjs/common";
import { ProductImportService } from "./product-import.service";
import { ProductImportController } from "./product-import.controller";
import { AdminExportsService } from "./admin-exports.service";
import { AdminExportsController } from "./admin-exports.controller";
import { ShopsModule } from "../shops/shops.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  // AuthModule : AdminExportsController s'appuie sur JwtAuthGuard, qui a
  // besoin de JwtService — même correctif de DI que AdminCockpitModule /
  // AdminTeamModule (voir leur commentaire équivalent).
  imports: [ShopsModule, AuthModule],
  providers: [ProductImportService, AdminExportsService],
  controllers: [ProductImportController, AdminExportsController],
})
export class ImportExportModule {}
