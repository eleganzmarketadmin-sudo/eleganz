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
import { BillingModule } from "./billing/billing.module";
import { AdminCockpitModule } from "./admin-cockpit/admin-cockpit.module";
import { AdminTeamModule } from "./admin-team/admin-team.module";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { AdminSettingsModule } from "./admin-settings/admin-settings.module";
import { ImportExportModule } from "./import-export/import-export.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ReportsModule } from "./reports/reports.module";
import { SupervisionModule } from "./supervision/supervision.module";
import { ComptableModule } from "./comptable/comptable.module";
import { FinanceModule } from "./finance/finance.module";
import { AiCreditsModule } from "./ai-credits/ai-credits.module";

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
    BillingModule,
    AdminCockpitModule,
    AdminTeamModule,
    AdminUsersModule,
    AdminSettingsModule,
    ImportExportModule,
    ReviewsModule,
    ReportsModule,
    SupervisionModule,
    ComptableModule,
    FinanceModule,
    AiCreditsModule,
  ],
})
export class AppModule {}
