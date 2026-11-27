import { Module } from "@nestjs/common";
import { BoostExterneService } from "./boost-externe.service";
import { BoostExterneController } from "./boost-externe.controller";
import { ReseauPubAdapterFactory } from "./reseaux/reseau-pub-adapter.factory";
import { MetaAdsAdapter } from "./reseaux/meta-ads.adapter";
import { TiktokAdsAdapter } from "./reseaux/tiktok-ads.adapter";
import { GoogleAdsAdapter } from "./reseaux/google-ads.adapter";
import { XAdsAdapter } from "./reseaux/x-ads.adapter";
import { ShopsModule } from "../shops/shops.module";
import { NotificationsModule } from "../notifications/notifications.module";

// Même montage que BoostModule : ShopsModule fournit ShopMembershipGuard
// ET, en le ré-exportant, AuthModule (JwtAuthGuard en dépend).
//
// N'IMPORTE PAS BillingModule : c'est BillingModule qui importe
// BoostExterneModule (pour déclencher activerDepuisFacture après paiement
// des frais ELEGANZ, voir billing.controller.ts) — un import dans l'autre
// sens créerait une dépendance circulaire, même précaution que BoostModule.
//
// N'IMPORTE PAS NON PLUS BoostModule (BoostCanalConfig reste lu/écrit par
// BoostAdminService, réutilisé tel quel — voir boost-externe.service.ts,
// qui lit cette table directement via PrismaService sans dépendre du
// module Boost).
@Module({
  imports: [ShopsModule, NotificationsModule],
  providers: [BoostExterneService, ReseauPubAdapterFactory, MetaAdsAdapter, TiktokAdsAdapter, GoogleAdsAdapter, XAdsAdapter],
  controllers: [BoostExterneController],
  exports: [BoostExterneService],
})
export class BoostExterneModule {}
