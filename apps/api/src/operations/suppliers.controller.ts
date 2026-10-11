import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto, RecordPurchaseDto } from "./dto/supplier.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";

@Controller("shops/:shopId/suppliers")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
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
  settle(@Param("supplierId") supplierId: string, @Body("amount") amount: number) {
    return this.suppliersService.settleDebt(supplierId, amount);
  }
}
