import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { StockValorisationService } from "./stock-valorisation.service";
import { CreateReceptionStockDto } from "./dto/reception-stock.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";

/**
 * Réceptions de stock valorisées (CUMP) — chantier SYSCOHADA phase 4.
 * Mêmes rôles que les autres écrans de gestion sensible (achats, charges).
 */
@Controller("shops/:shopId/stock")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
export class StockValorisationController {
  constructor(private readonly stock: StockValorisationService) {}

  @Post("receptions")
  receptionner(@Param("shopId") shopId: string, @Body() dto: CreateReceptionStockDto) {
    return this.stock.receptionner(shopId, dto);
  }

  @Get("variantes/:variantId/receptions")
  list(@Param("shopId") shopId: string, @Param("variantId") variantId: string) {
    return this.stock.listPourVariante(shopId, variantId);
  }
}
