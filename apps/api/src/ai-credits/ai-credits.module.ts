import { Module } from "@nestjs/common";
import { AiCreditsService } from "./ai-credits.service";
import { AiCreditsController } from "./ai-credits.controller";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";

// Services à la carte — crédits IA (14 oct. 2026, plan commercial). Importe
// ShopsModule pour JwtAuthGuard/ShopMembershipGuard (même pattern que
// BillingModule/FinanceModule) et FinanceModule pour AccountingService
// (reconnaissance du revenu au paiement effectif d'une facture de crédits).
@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [AiCreditsService],
  controllers: [AiCreditsController],
  exports: [AiCreditsService],
})
export class AiCreditsModule {}
