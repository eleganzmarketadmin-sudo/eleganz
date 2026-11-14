import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { AdminInstitutionsService } from "./admin-institutions.service";
import { AdminInstitutionsController } from "./admin-institutions.controller";

// Importe ShopsModule pour JwtAuthGuard (même nécessité documentée dans
// FinanceModule/InstitutionsModule) — AdminTeamModule n'est pas importé
// ici : requireSuperAdmin est une simple fonction exportée, pas un
// provider Nest.
@Module({
  imports: [ShopsModule],
  providers: [AdminInstitutionsService],
  controllers: [AdminInstitutionsController],
})
export class AdminInstitutionsModule {}
