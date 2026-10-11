import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { OrderStatus, StaffRole } from "@eleganz/database";

// Vue vendeur : chaque boutique ne voit que ses propres sous-commandes
// (ShopMembershipGuard empêche l'accès aux commandes d'une autre boutique —
// séparation exigée par le prompt §48).
@Controller("shops/:shopId/orders")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ShopOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.ordersService.listForShop(shopId);
  }

  @Patch(":shopOrderId/status")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
  updateStatus(@Param("shopOrderId") shopOrderId: string, @Body("status") status: OrderStatus) {
    return this.ordersService.transitionStatus(shopOrderId, status);
  }
}
