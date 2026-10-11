import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CatalogController } from "./catalog.controller";
import { ShopsModule } from "../shops/shops.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [ShopsModule, StorageModule],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
