import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { SubscriptionPlansController } from "./subscription-plans.controller";
import { ShopSubscriptionController } from "./shop-subscription.controller";
import { BoostTarifsService } from "./boost-tarifs.service";
import { BoostTarifsController } from "./boost-tarifs.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../storage/storage.module";
import { BoostModule } from "../boost/boost.module";

// NotificationsModule (notifierMulticanal) et StorageModule
// (creerUrlUpload, preuves de paiement) ajoutés le 16 nov. 2026, chantier
// relances/recouvrement — voir BillingService.
// BoostModule (26 nov. 2026) : importé uniquement pour que BillingController
// puisse déclencher l'activation d'un boost juste après avoir marqué sa
// facture payée (voir BillingController.markPaid) — BillingService lui-même
// reste inchangé, aucune dépendance ajoutée dedans.
@Module({
  imports: [ShopsModule, FinanceModule, NotificationsModule, StorageModule, BoostModule],
  providers: [BillingService, SubscriptionPlansService, BoostTarifsService],
  controllers: [BillingController, SubscriptionPlansController, ShopSubscriptionController, BoostTarifsController],
  exports: [BillingService, SubscriptionPlansService],
})
export class BillingModule {}
