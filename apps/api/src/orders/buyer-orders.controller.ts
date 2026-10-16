import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("marketplace/orders")
@UseGuards(JwtAuthGuard)
export class BuyerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listForBuyer(user.id);
  }

  @Post(":shopOrderId/confirm-receipt")
  confirmReceipt(@CurrentUser() user: AuthenticatedUser, @Param("shopOrderId") shopOrderId: string) {
    return this.ordersService.confirmReceipt(shopOrderId, user.id);
  }

  // Annulation côté acheteur (demande du 16 oct. 2026, point 4) — symétrique
  // au bouton d'annulation déjà existant côté boutique dans Gestion.
  @Post(":shopOrderId/cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("shopOrderId") shopOrderId: string) {
    return this.ordersService.cancelByBuyer(shopOrderId, user.id);
  }
}
