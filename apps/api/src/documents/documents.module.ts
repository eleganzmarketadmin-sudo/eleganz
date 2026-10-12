import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { ShopsModule } from "../shops/shops.module";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";

@Module({
  imports: [ShopsModule, AdminSettingsModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
