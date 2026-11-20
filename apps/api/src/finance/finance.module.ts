import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { FiscalRulesService } from "./fiscal-rules.service";
import { FiscalRemittanceService } from "./fiscal-remittance.service";
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
import { RapportAnnuelService } from "./rapport-annuel.service";
import { ExpensesService } from "../operations/expenses.service";
import { ExpensesController } from "../operations/expenses.controller";
import { LoansService } from "./loans.service";
import { AdminSettingsModule } from "../admin-settings/admin-settings.module";

// Module "FINANCE & COMPTABILITÉ" (prompt du 13 oct. 2026) — voir
// docs/ARCHITECTURE_FINANCE.md. Importe ShopsModule pour obtenir
// JwtAuthGuard + ShopMembershipGuard en une seule ligne (même pattern que
// OperationsModule) — sans cet import, JwtAuthGuard ne résout pas ses
// dépendances et l'API entière refuse de démarrer (leçon déjà documentée
// dans docs/MAINTENANCE.md, incident AuthModule).
//
// ExpensesService/ExpensesController rapatriés depuis OperationsModule le
// 18 oct. 2026 (audit du 18 oct. 2026, point 7) — AdminFinanceController a
// besoin d'injecter ExpensesService pour les charges plateforme, et
// OperationsModule importe déjà FinanceModule (pour AccountingService) :
// l'inverse (FinanceModule → OperationsModule) créerait un import de
// module circulaire. Même règle déjà appliquée à Assets/TresorerieComptes,
// qui vivaient ici dès le départ malgré leurs routes shop-scoped.
@Module({
  // AdminSettingsModule (20 nov. 2026) : AdminFinanceController a besoin
  // d'injecter AdminSettingsService pour l'identité plateforme (logo/
  // en-tête/pied de page) du dossier de crédit ELEGANZ — AdminSettingsModule
  // n'importe ni FinanceModule ni ComptableModule, aucun cycle créé.
  imports: [ShopsModule, AdminSettingsModule],
  providers: [
    FinanceService,
    FiscalRulesService,
    FiscalRemittanceService,
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
    RapportAnnuelService,
    ExpensesService,
    LoansService,
  ],
  controllers: [
    FinanceController,
    AdminFinanceController,
    AssetsController,
    TresorerieComptesController,
    StockValorisationController,
    ExpensesController,
  ],
  // BusinessPlanService/LoansService exportés depuis le 14 nov. 2026 pour le
  // portail institutions (InstitutionsModule) — consultation du dossier
  // crédit d'une boutique et décaissement via une décision d'institution.
  // FinanceService exporté depuis le 16 nov. 2026 (gestion de crédit PME
  // complète, DemandeCredit) : InstitutionsModule a besoin de
  // FinanceService.dossierCredit() pour figer les vrais chiffres financiers
  // d'une boutique au moment de la réception d'une demande — jusqu'ici
  // InstitutionPortalService ne lisait que le narratif BusinessPlan.
  exports: [AccountingService, BusinessPlanService, LoansService, FinanceService],
})
export class FinanceModule {}
