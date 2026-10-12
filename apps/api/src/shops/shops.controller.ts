import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateInvoiceSettingsDto } from "./dto/update-invoice-settings.dto";
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

  @Patch(":shopId/invoice-settings")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  updateInvoiceSettings(@Param("shopId") shopId: string, @Body() dto: UpdateInvoiceSettingsDto) {
    return this.shopsService.updateInvoiceSettings(shopId, dto);
  }

  @Get(":shopId/staff")
  @UseGuards(ShopMembershipGuard)
  listStaff(@Param("shopId") shopId: string) {
    return this.shopsService.listStaff(shopId);
  }

  @Post(":shopId/staff")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  inviteStaff(@Param("shopId") shopId: string, @Body() dto: InviteStaffDto) {
    return this.shopsService.inviteStaff(shopId, dto);
  }

  @Delete(":shopId/staff/:staffId")
  @UseGuards(ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  removeStaff(@Param("shopId") shopId: string, @Param("staffId") staffId: string) {
    return this.shopsService.deactivateStaff(shopId, staffId);
  }
}
