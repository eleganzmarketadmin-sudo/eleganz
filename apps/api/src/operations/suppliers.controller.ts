import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto, RecordPurchaseDto, SettleDebtDto } from "./dto/supplier.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";

// Fournisseurs, prix d'achat et dettes : données de gestion sensibles,
// réservées aux rôles qui en ont besoin (prompt §10 — un caissier ne doit
// pas pouvoir consulter toutes les données confidentielles de la boutique).
const SUPPLIER_MANAGEMENT_ROLES = [StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT];

@Controller("shops/:shopId/suppliers")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(...SUPPLIER_MANAGEMENT_ROLES)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.suppliersService.list(shopId);
  }

  @Post()
  create(@Param("shopId") shopId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(shopId, dto);
  }

  @Post(":supplierId/purchases")
  recordPurchase(@Param("supplierId") supplierId: string, @Body() dto: RecordPurchaseDto) {
    return this.suppliersService.recordPurchase(supplierId, dto);
  }

  @Post(":supplierId/settle")
  settle(@Param("supplierId") supplierId: string, @Body() dto: SettleDebtDto) {
    return this.suppliersService.settleDebt(supplierId, dto);
  }

  @Get("echeancier")
  echeancier(@Param("shopId") shopId: string) {
    return this.suppliersService.echeancier(shopId);
  }
}
