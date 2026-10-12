import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { CreateDeliveryZoneDto, RegisterDriverDto } from "./dto/delivery.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("delivery")
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get("zones")
  listZones() {
    return this.deliveryService.listZones();
  }

  @Post("zones")
  @UseGuards(JwtAuthGuard)
  createZone(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryZoneDto) {
    if (!user.role.startsWith("ADMIN_")) {
      throw new ForbiddenException("Seule l'administration ELEGANZ peut créer une zone de livraison.");
    }
    return this.deliveryService.createZone(dto);
  }

  @Post("drivers/register")
  @UseGuards(JwtAuthGuard)
  registerDriver(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDriverDto) {
    return this.deliveryService.registerDriver(user.id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.myProfile(user.id);
  }

  // Centre de gestion des partenaires livreurs (prompt §10 et §37) : lister
  // les livreurs inscrits et faire basculer leur vérification. Sans cette
  // vérification, assignDriver() refuse déjà toute affectation de mission
  // (voir DeliveryService.assignDriver) — ces routes donnent à l'admin le
  // moyen de la faire passer à true depuis l'écran, sans toucher au code.
  @Get("drivers")
  @UseGuards(JwtAuthGuard)
  listDrivers(@CurrentUser() user: AuthenticatedUser) {
    if (!user.role.startsWith("ADMIN_")) {
      throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
    }
    return this.deliveryService.adminListDrivers();
  }

  @Post("drivers/:driverId/verify")
  @UseGuards(JwtAuthGuard)
  verifyDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Param("driverId") driverId: string,
    @Body("verified") verified: boolean,
  ) {
    if (!user.role.startsWith("ADMIN_")) {
      throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
    }
    return this.deliveryService.adminSetVerified(driverId, verified);
  }

  @Get("my-deliveries")
  @UseGuards(JwtAuthGuard)
  myDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.myDeliveries(user.id);
  }

  @Post("my-deliveries/:shopOrderId/picked-up")
  @UseGuards(JwtAuthGuard)
  confirmPickup(@CurrentUser() user: AuthenticatedUser, @Param("shopOrderId") shopOrderId: string) {
    return this.deliveryService.confirmPickup(shopOrderId, user.id);
  }

  @Post("my-deliveries/:shopOrderId/delivered")
  @UseGuards(JwtAuthGuard)
  confirmDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopOrderId") shopOrderId: string,
    @Body("proofCode") proofCode?: string,
  ) {
    return this.deliveryService.confirmDelivery(shopOrderId, user.id, proofCode);
  }
}

// Affectation d'un livreur à une sous-commande : côté vendeur, donc rattachée
// aux routes shops/:shopId/orders plutôt qu'à /delivery.
@Controller("shops/:shopId/orders/:shopOrderId/driver")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
export class AssignDriverController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  assign(@Param("shopOrderId") shopOrderId: string, @Body("driverId") driverId: string) {
    return this.deliveryService.assignDriver(shopOrderId, driverId);
  }
}
