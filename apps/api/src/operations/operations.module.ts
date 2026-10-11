import { Module } from "@nestjs/common";
import { ShopsModule } from "../shops/shops.module";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";
import { ExpensesService } from "./expenses.service";
import { ExpensesController } from "./expenses.controller";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";

// Regroupe les modules de priorité 2 du complément stratégique ELEGANZ
// Gestion : achats/fournisseurs, dépenses, clients et ventes à crédit.
@Module({
  imports: [ShopsModule],
  providers: [SuppliersService, ExpensesService, CustomersService],
  controllers: [SuppliersController, ExpensesController, CustomersController],
  exports: [CustomersService],
})
export class OperationsModule {}
