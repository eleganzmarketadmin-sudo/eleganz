import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
import { PasswordResetModule } from "./password-reset/password-reset.module";
import { AdminSettingsModule } from "./admin-settings/admin-settings.module";
import { ImportExportModule } from "./import-export/import-export.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ReportsModule } from "./reports/reports.module";
import { SupervisionModule } from "./supervision/supervision.module";
import { ComptableModule } from "./comptable/comptable.module";
import { FinanceModule } from "./finance/finance.module";
import { AiCreditsModule } from "./ai-credits/ai-credits.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MessagingModule } from "./messaging/messaging.module";
import { EcheancierModule } from "./echeancier/echeancier.module";
import { GeoModule } from "./geo/geo.module";
import { AddressesModule } from "./addresses/addresses.module";
import { ExpertsModule } from "./experts/experts.module";
import { CronModule } from "./cron/cron.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Active globalement le mécanisme @Cron utilisé par CronJobsService
    // (18 oct. 2026, automatisation du cycle de facturation) — un seul
    // ScheduleModule.forRoot() pour toute l'application.
    ScheduleModule.forRoot(),
    // Limite de débit globale (20 oct. 2026, audit de lancement) — avant ce
    // correctif, rien ne protégeait /auth/login ou /auth/register contre un
    // bruteforce automatisé. Un plafond généreux par défaut (300 requêtes/min
    // par IP) sert de filet de sécurité général ; AuthController applique en
    // plus une limite bien plus stricte sur login/register via @Throttle.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 300 }]),
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
    PasswordResetModule,
    AdminSettingsModule,
    ImportExportModule,
    ReviewsModule,
    ReportsModule,
    SupervisionModule,
    ComptableModule,
    FinanceModule,
    AiCreditsModule,
    NotificationsModule,
    MessagingModule,
    EcheancierModule,
    GeoModule,
    AddressesModule,
    ExpertsModule,
    CronModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
