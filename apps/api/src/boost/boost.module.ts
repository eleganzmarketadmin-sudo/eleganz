import { Module } from "@nestjs/common";
import { BoostService } from "./boost.service";
import { BoostController } from "./boost.controller";
import { BoostAdminService } from "./boost-admin.service";
import { BoostAdminController } from "./boost-admin.controller";
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
//
// BoostAdminService/BoostAdminController (27 nov. 2026, refonte Centre de
// pilotage Boost) : canaux externes/coûts externes/rapport — voir leur
// commentaire d'en-tête. Logiquement distincts de BoostService (achat/cycle
// de vie d'un boost) mais regroupés dans ce même module : même domaine,
// même PrismaService, pas de dépendance croisée à gérer.
@Module({
  imports: [ShopsModule, NotificationsModule],
  providers: [BoostService, BoostAdminService],
  controllers: [BoostController, BoostAdminController],
  exports: [BoostService],
})
export class BoostModule {}
