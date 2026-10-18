import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { FinanceModule } from "../finance/finance.module";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { RelancesService } from "./relances.service";
import { RelancesController } from "./relances.controller";

// Regroupe les modules de priorité 2 du complément stratégique ELEGANZ
// Gestion : achats/fournisseurs, dépenses, clients et ventes à crédit.
//
// ExpensesService/ExpensesController déménagés dans FinanceModule le 18
// oct. 2026 (audit du 18 oct. 2026, point 7) — voir le commentaire dans
// finance.module.ts. FinanceModule reste importé ici pour AccountingService
// (utilisé par SuppliersService/RelancesService).
@Module({
  imports: [ShopsModule, FinanceModule],
  providers: [SuppliersService, CustomersService, RelancesService],
  controllers: [SuppliersController, CustomersController, RelancesController],
  exports: [CustomersService],
})
export class OperationsModule {}
