import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ShopInstitutionsService } from "./shop-institutions.service";
import { GrantInstitutionAccessDto } from "./dto/institution.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

// Catalogue public (aux comptes authentifiés) des institutions partenaires
// — distinct du reste, pas de scoping par boutique puisqu'il s'agit de la
// liste commune à toute la plateforme (même principe que
// DeliveryController.available pour les livreurs).
@Controller("institutions")
@UseGuards(JwtAuthGuard)
export class InstitutionsCatalogueController {
  constructor(private readonly shopInstitutions: ShopInstitutionsService) {}

  @Get("catalogue")
  catalogue() {
    return this.shopInstitutions.catalogue();
  }
}

@Controller("shops/:shopId/institutions")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ShopInstitutionsController {
  constructor(private readonly shopInstitutions: ShopInstitutionsService) {}

  @Get()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  mesAcces(@Param("shopId") shopId: string) {
    return this.shopInstitutions.mesAcces(shopId);
  }

  @Post()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  accorder(
    @Param("shopId") shopId: string,
    @Body() dto: GrantInstitutionAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shopInstitutions.accorder(shopId, dto.institutionId, user.id);
  }

  @Delete(":institutionId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  revoquer(@Param("shopId") shopId: string, @Param("institutionId") institutionId: string) {
    return this.shopInstitutions.revoquer(shopId, institutionId);
  }

  @Get("decisions")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  mesDecisions(@Param("shopId") shopId: string) {
    return this.shopInstitutions.mesDecisions(shopId);
  }
}
