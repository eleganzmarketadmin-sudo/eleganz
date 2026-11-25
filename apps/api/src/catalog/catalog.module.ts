import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CatalogController, VariantOptionsController, ProductCategoriesController } from "./catalog.controller";
import { ShopsModule } from "../shops/shops.module";
import { StorageModule } from "../storage/storage.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ShopsModule, StorageModule, NotificationsModule],
  providers: [CatalogService],
  controllers: [CatalogController, VariantOptionsController, ProductCategoriesController],
  exports: [CatalogService],
})
export class CatalogModule {}
