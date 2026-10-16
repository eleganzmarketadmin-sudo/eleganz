import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { FiscalRulesService } from "./fiscal-rules.service";
import { AdminFinanceService } from "./admin-finance.service";
import { AdminFinanceController } from "./admin-finance.controller";
import { AccountingSeedService } from "./accounting-seed.service";
import { AccountingService } from "./accounting.service";
import { AccountingQueryService } from "./accounting-query.service";
import { AssetsService } from "./assets.service";
import { AssetsController } from "./assets.controller";
import { ClosureService } from "./closure.service";
import { FiscalSimulationService } from "./fiscal-simulation.service";
import { TresorerieComptesService } from "./tresorerie-comptes.service";
import { TresorerieComptesController } from "./tresorerie-comptes.controller";
import { StockValorisationService } from "./stock-valorisation.service";
import { StockValorisationController } from "./stock-valorisation.controller";
import { DossierValidationService } from "./dossier-validation.service";
import { BusinessPlanService } from "./business-plan.service";

// Module "FINANCE & COMPTABILITÉ" (prompt du 13 oct. 2026) — voir
// docs/ARCHITECTURE_FINANCE.md. Importe ShopsModule pour obtenir
// JwtAuthGuard + ShopMembershipGuard en une seule ligne (même pattern que
// OperationsModule) — sans cet import, JwtAuthGuard ne résout pas ses
// dépendances et l'API entière refuse de démarrer (leçon déjà documentée
// dans docs/MAINTENANCE.md, incident AuthModule).
@Module({
  imports: [ShopsModule],
  providers: [
    FinanceService,
    FiscalRulesService,
    AdminFinanceService,
    AccountingSeedService,
    AccountingService,
    AccountingQueryService,
    AssetsService,
    ClosureService,
    FiscalSimulationService,
    TresorerieComptesService,
    StockValorisationService,
    DossierValidationService,
    BusinessPlanService,
  ],
  controllers: [
    FinanceController,
    AdminFinanceController,
    AssetsController,
    TresorerieComptesController,
    StockValorisationController,
  ],
  exports: [AccountingService],
})
export class FinanceModule {}
