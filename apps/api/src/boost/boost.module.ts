import { Module } from "@nestjs/common";
import { BoostService } from "./boost.service";
import { BoostController } from "./boost.controller";
import { ShopsModule } from "../shops/shops.module";
import { NotificationsModule } from "../notifications/notifications.module";

// ShopsModule fournit ShopMembershipGuard (utilisé par BoostController) ET,
// en le ré-exportant lui-même, AuthModule (JwtAuthGuard en dépend) — même
// montage que BillingModule, pas besoin d'importer AuthModule séparément.
//
// N'IMPORTE PAS BillingModule : c'est BillingModule qui importe BoostModule
// (pour que BillingController déclenche l'activation d'un boost après
// paiement, voir boost.service.ts/activerDepuisFacture) — un import dans
// l'autre sens créerait une dépendance circulaire entre modules.
@Module({
  imports: [ShopsModule, NotificationsModule],
  providers: [BoostService],
  controllers: [BoostController],
  exports: [BoostService],
})
export class BoostModule {}
