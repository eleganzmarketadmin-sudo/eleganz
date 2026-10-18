import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { UpdateInvoiceSettingsDto } from "./dto/update-invoice-settings.dto";
import { CreateShopDriverDto, UpdateShopDriverDto } from "./dto/shop-driver.dto";
import { AddDeliveryZoneDto } from "./dto/add-delivery-zone.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "./shop-membership.guard";
import { ShopRoles } from "./roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("shops")
@UseGuards(JwtAuthGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShopDto) {
    // Le propriétaire est TOUJOURS l'utilisateur authentifié, jamais un id du corps de la requête.
    return this.shopsService.create(user.id, dto);
  }

  @Get("mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.shopsService.findMine(user.id);
  }

  @Post(":shopId/publish")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  publish(@Param("shopId") shopId: string, @Body("productIds") productIds: string[]) {
    return this.shopsService.publishSelection(shopId, productIds);
  }

  @Post(":shopId/unpublish")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  unpublish(@Param("shopId") shopId: string, @Body("productIds") productIds: string[]) {
    return this.shopsService.unpublishSelection(shopId, productIds);
  }

  @Get(":shopId")
  @UseGuards(ShopMembershipGuard)
  findOne(@Param("shopId") shopId: string) {
    return this.shopsService.findOne(shopId);
  }

  // Fermeture en libre-service (18 oct. 2026) — réservée au propriétaire
  // (jamais un gérant ni un autre membre d'équipe), bloquée tant qu'il
  // reste une facture ELEGANZ impayée (voir ShopsService.fermerBoutique).
  @Post(":shopId/close")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  close(@Param("shopId") shopId: string) {
    return this.shopsService.fermerBoutique(shopId);
  }

  @Patch(":shopId/invoice-settings")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  updateInvoiceSettings(@Param("shopId") shopId: string, @Body() dto: UpdateInvoiceSettingsDto) {
    return this.shopsService.updateInvoiceSettings(shopId, dto);
  }

  // Correctif de sécurité (16 oct. 2026, point 2 des propositions du 16 oct.
  // 2026) : cette route n'avait AUCUN @ShopRoles jusqu'ici — n'importe quel
  // membre actif (caissier, magasinier...) pouvait lire la liste complète de
  // l'équipe (emails, téléphones). Alignée sur les mêmes rôles que l'invitation
  // et la suppression ci-dessous.
  @Get(":shopId/staff")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  listStaff(@Param("shopId") shopId: string) {
    return this.shopsService.listStaff(shopId);
  }

  @Post(":shopId/staff")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  inviteStaff(@Param("shopId") shopId: string, @Body() dto: InviteStaffDto) {
    return this.shopsService.inviteStaff(shopId, dto);
  }

  // Modification d'un profil d'équipe déjà actif (16 oct. 2026, point 2 des
  // propositions du 16 oct. 2026) — n'existait pas avant : seules
  // l'invitation (création) et la suppression étaient possibles. Permet de
  // changer le rôle et/ou les écrans de menu accordés ("décocher/cocher ou
  // modifier plus tard").
  @Patch(":shopId/staff/:staffId")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  updateStaff(
    @Param("shopId") shopId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.shopsService.updateStaff(shopId, staffId, dto);
  }

  @Delete(":shopId/staff/:staffId")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  removeStaff(@Param("shopId") shopId: string, @Param("staffId") staffId: string) {
    return this.shopsService.deactivateStaff(shopId, staffId);
  }

  // Livreurs propres à la boutique (13 oct. 2026, 1ʳᵉ demande du jour) —
  // mêmes rôles que l'affectation de livreur existante (ShopRoles sur
  // AssignDriverController, delivery.controller.ts), pour rester cohérent :
  // qui peut affecter un livreur peut aussi gérer la liste.
  @Get(":shopId/drivers")
  @UseGuards(ShopMembershipGuard)
  listShopDrivers(@Param("shopId") shopId: string) {
    return this.shopsService.listShopDrivers(shopId);
  }

  @Post(":shopId/drivers")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
  createShopDriver(@Param("shopId") shopId: string, @Body() dto: CreateShopDriverDto) {
    return this.shopsService.createShopDriver(shopId, dto);
  }

  @Patch(":shopId/drivers/:driverId")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SALES_LEAD, StaffRole.STOCK_KEEPER)
  updateShopDriver(
    @Param("shopId") shopId: string,
    @Param("driverId") driverId: string,
    @Body() dto: UpdateShopDriverDto,
  ) {
    return this.shopsService.updateShopDriver(shopId, driverId, dto);
  }

  // Zones de livraison (prompt du 15 oct. 2026) — mêmes rôles que les
  // réglages de facturation : qui peut changer les paramètres de la
  // boutique peut aussi déclarer où elle livre.
  @Get(":shopId/delivery-zones")
  @UseGuards(ShopMembershipGuard)
  listDeliveryZones(@Param("shopId") shopId: string) {
    return this.shopsService.listDeliveryZones(shopId);
  }

  @Post(":shopId/delivery-zones")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  addDeliveryZone(@Param("shopId") shopId: string, @Body() dto: AddDeliveryZoneDto) {
    return this.shopsService.addDeliveryZone(shopId, dto);
  }

  @Delete(":shopId/delivery-zones/:zoneId")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  removeDeliveryZone(@Param("shopId") shopId: string, @Param("zoneId") zoneId: string) {
    return this.shopsService.removeDeliveryZone(shopId, zoneId);
  }
}
