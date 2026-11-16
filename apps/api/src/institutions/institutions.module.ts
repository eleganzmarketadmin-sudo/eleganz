import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";
import { ShopInstitutionsService } from "./shop-institutions.service";
import { ShopInstitutionsController, InstitutionsCatalogueController } from "./shop-institutions.controller";
import { InstitutionPortalService } from "./institution-portal.service";
import { InstitutionPortalController } from "./institution-portal.controller";
import { InstitutionStaffService } from "./institution-staff.service";
import { InstitutionMembershipGuard } from "./institution-membership.guard";
import { DemandeCreditService } from "./demande-credit.service";

// Portail institutions financières partenaires (14 nov. 2026 — microfinances,
// banques, coopératives). Importe ShopsModule (JwtAuthGuard/ShopMembershipGuard,
// même nécessité documentée dans FinanceModule) et FinanceModule
// (BusinessPlanService pour lire le dossier crédit, LoansService pour
// décaisser/comptabiliser via une décision d'institution, et depuis le 16
// nov. 2026 FinanceService pour figer les vrais chiffres financiers d'une
// boutique dans une DemandeCredit).
@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [
    ShopInstitutionsService,
    InstitutionPortalService,
    InstitutionStaffService,
    InstitutionMembershipGuard,
    DemandeCreditService,
  ],
  controllers: [ShopInstitutionsController, InstitutionsCatalogueController, InstitutionPortalController],
})
export class InstitutionsModule {}
