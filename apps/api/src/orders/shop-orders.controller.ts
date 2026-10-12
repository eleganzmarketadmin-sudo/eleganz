import { Body, Controller, Get, Param, Patch, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { OrderStatus, StaffRole } from "@eleganz/database";
import { construireClasseurExcel } from "../common/xlsx.util";

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

  @Get("export")
  async export(@Param("shopId") shopId: string, @Res() res: Response) {
    const commandes = await this.ordersService.listForShop(shopId);
    const lignes = commandes.map((c) => [
      c.id.slice(0, 8),
      c.status,
      Number(c.subtotal),
      c.order.buyer?.fullName ?? "",
      c.order.buyerWhatsapp ?? c.order.buyerPhone ?? "",
      [c.order.deliveryAvenue, c.order.deliveryQuartier, c.order.deliveryCommune].filter(Boolean).join(", "),
      new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(c.createdAt),
    ]);
    const buffer = construireClasseurExcel(
      "Commandes Marketplace",
      ["N°", "Statut", "Sous-total", "Acheteur", "Contact", "Adresse de livraison", "Date"],
      lignes,
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="mes-commandes-eleganz.xlsx"');
    res.send(buffer);
  }

  @Patch(":shopOrderId/status")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
  updateStatus(@Param("shopOrderId") shopOrderId: string, @Body("status") status: OrderStatus) {
    return this.ordersService.transitionStatus(shopOrderId, status);
  }
}
