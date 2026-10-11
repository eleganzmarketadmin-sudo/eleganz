import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ShopsModule } from "./shops/shops.module";
import { CatalogModule } from "./catalog/catalog.module";
import { PosModule } from "./pos/pos.module";
import { DocumentsModule } from "./documents/documents.module";
import { OperationsModule } from "./operations/operations.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { OrdersModule } from "./orders/orders.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { DisputesModule } from "./disputes/disputes.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ShopsModule,
    CatalogModule,
    PosModule,
    DocumentsModule,
    OperationsModule,
    MarketplaceModule,
    OrdersModule,
    DeliveryModule,
    DisputesModule,
  ],
})
export class AppModule {}
