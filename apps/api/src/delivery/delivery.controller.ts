import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { CreateDeliveryZoneDto, RechercherLivreursDto, RegisterDriverDto, RepondreDemandeLivreurDto } from "./dto/delivery.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, MenuAdmin } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

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
    // Écran Livreurs (LIVREURS) — voir audit du 18 oct. 2026.
    requireAdminMenu(user, MenuAdmin.LIVREURS);
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

  // Demandes d'ajout à une liste de livreurs agréés, reçues par CE livreur
  // (20 nov. 2026, réouverture du réseau) — jamais un ajout unilatéral de
  // la boutique, le livreur accepte ou refuse ici. Voir
  // DeliveryService.demanderAccesLivreur/repondreDemandeLivreur.
  @Get("me/demandes")
  @UseGuards(JwtAuthGuard)
  mesDemandes(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.mesDemandesLivreur(user.id);
  }

  @Post("me/demandes/:accessId/repondre")
  @UseGuards(JwtAuthGuard)
  repondreDemande(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accessId") accessId: string,
    @Body() dto: RepondreDemandeLivreurDto,
  ) {
    return this.deliveryService.repondreDemandeLivreur(user.id, accessId, dto.accepte);
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
    requireAdminMenu(user, MenuAdmin.LIVREURS);
    return this.deliveryService.adminListDrivers();
  }

  @Post("drivers/:driverId/verify")
  @UseGuards(JwtAuthGuard)
  verifyDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Param("driverId") driverId: string,
    @Body("verified") verified: boolean,
  ) {
    requireAdminMenu(user, MenuAdmin.LIVREURS);
    return this.deliveryService.adminSetVerified(driverId, verified, user.id);
  }

  @Post("drivers/:driverId/note")
  @UseGuards(JwtAuthGuard)
  setDriverNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("driverId") driverId: string,
    @Body("adminNote") adminNote: string,
  ) {
    requireAdminMenu(user, MenuAdmin.LIVREURS);
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
  // propre à la boutique). `driverId` (réseau ELEGANZ) redevient utilisable
  // le 20 nov. 2026 (réouverture du réseau) — mais seulement pour un livreur
  // déjà dans la liste de livreurs agréés de CETTE boutique, voir
  // DeliveryService.assignDriver.
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
    return this.deliveryService.assignDriver(shopId, shopOrderId, driverId || null);
  }
}

// Réseau de livreurs ELEGANZ côté boutique (20 nov. 2026, réouverture) :
// rechercher un livreur vérifié, demander son ajout à sa propre liste de
// livreurs agréés, consulter cette liste, révoquer un accès. Préfixe
// "driver-network" choisi pour ne jamais entrer en collision avec
// shops/:shopId/drivers (CRUD ShopDriver déjà existant, inchangé) — voir
// ShopDriversController. Mêmes rôles que l'affectation ci-dessus : le
// personnel qui peut affecter un livreur est celui qui gère ce réseau.
@Controller("shops/:shopId/driver-network")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
export class ShopDriverNetworkController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get("search")
  rechercher(@Query() dto: RechercherLivreursDto) {
    return this.deliveryService.rechercherLivreurs(dto);
  }

  @Get("roster")
  roster(@Param("shopId") shopId: string) {
    return this.deliveryService.mesLivreursAgrees(shopId);
  }

  @Post("roster/:driverId")
  demanderAcces(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Param("driverId") driverId: string,
  ) {
    return this.deliveryService.demanderAccesLivreur(shopId, driverId, user.id);
  }

  @Delete("roster/:accessId")
  revoquerAcces(@Param("shopId") shopId: string, @Param("accessId") accessId: string) {
    return this.deliveryService.revoquerAccesLivreur(shopId, accessId);
  }
}
