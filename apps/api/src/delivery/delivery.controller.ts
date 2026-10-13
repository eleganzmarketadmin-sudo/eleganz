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

  // Liste des livreurs vérifiés, pour le sélecteur d'affectation côté
  // vendeur (prompt du 13 oct. 2026, point 1) — pas de portée par boutique,
  // le vivier de livreurs est commun à toute la plateforme ; réservé au
  // personnel de boutique et à l'admin, pas aux acheteurs ni aux livreurs.
  @Get("available")
  @UseGuards(JwtAuthGuard)
  available(@CurrentUser() user: AuthenticatedUser) {
    if (
      user.role !== "SHOP_OWNER" &&
      user.role !== "SHOP_STAFF" &&
      !user.role.startsWith("ADMIN_")
    ) {
      throw new ForbiddenException("Réservé au personnel de boutique.");
    }
    return this.deliveryService.listVerifiedDrivers();
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

  @Post("drivers/:driverId/note")
  @UseGuards(JwtAuthGuard)
  setDriverNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("driverId") driverId: string,
    @Body("adminNote") adminNote: string,
  ) {
    if (!user.role.startsWith("ADMIN_")) {
      throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
    }
    return this.deliveryService.adminSetNote(driverId, adminNote);
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
// aux routes shops/:shopId/orders plutôt qu'à /delivery. Même route pour
// affecter, réaffecter (le vendeur change de livreur en cas de besoin) et
// retirer l'affectation (driverId: null) — prompt du 13 oct. 2026, point 1.
@Controller("shops/:shopId/orders/:shopOrderId/driver")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
export class AssignDriverController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // `shopDriverId` est le chemin normal depuis le 13 oct. 2026 (livreur
  // propre à la boutique). `driverId` (réseau plateforme) est conservé en
  // body pour ne pas casser un appel existant, mais l'inscription livreur
  // plateforme étant fermée, ce chemin ne reçoit plus de nouveaux livreurs.
  @Post()
  assign(
    @Param("shopId") shopId: string,
    @Param("shopOrderId") shopOrderId: string,
    @Body("shopDriverId") shopDriverId: string | null | undefined,
    @Body("driverId") driverId: string | null | undefined,
  ) {
    if (shopDriverId !== undefined) {
      return this.deliveryService.assignShopDriver(shopId, shopOrderId, shopDriverId || null);
    }
    return this.deliveryService.assignDriver(shopOrderId, driverId || null);
  }
}
