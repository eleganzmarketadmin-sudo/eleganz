import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TresorerieComptesService } from "./tresorerie-comptes.service";
import { CreateMouvementTresorerieDto, CreateRapprochementDto, CreateTresorerieCompteDto } from "./dto/tresorerie.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
import { StaffRole } from "@eleganz/database";

/**
 * Trésorerie multi-comptes (banque, mobile money) — chantier SYSCOHADA
 * phase 2 (14 oct. 2026). Même garde que l'écran Trésorerie existant
 * (`tresorerie` dans featuresJson) : un compte réel de plus ne change pas
 * à quel bouquet cette fonctionnalité appartient.
 */
@Controller("shops/:shopId/tresorerie/comptes")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@RequiresGestionFeature("tresorerie")
export class TresorerieComptesController {
  constructor(private readonly comptes: TresorerieComptesService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.comptes.listForShop(shopId);
  }

  @Post()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  create(@Param("shopId") shopId: string, @Body() dto: CreateTresorerieCompteDto) {
    return this.comptes.create(shopId, dto);
  }

  @Post(":compteId/desactiver")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  desactiver(@Param("shopId") shopId: string, @Param("compteId") compteId: string) {
    return this.comptes.desactiver(shopId, compteId);
  }

  @Post(":compteId/mouvements")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  enregistrerMouvement(
    @Param("shopId") shopId: string,
    @Param("compteId") compteId: string,
    @Body() dto: CreateMouvementTresorerieDto,
  ) {
    return this.comptes.enregistrerMouvement(shopId, compteId, dto);
  }

  @Get(":compteId/rapprochements")
  listerRapprochements(@Param("shopId") shopId: string, @Param("compteId") compteId: string) {
    return this.comptes.listerRapprochements(shopId, compteId);
  }

  @Post(":compteId/rapprochements")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  creerRapprochement(
    @Param("shopId") shopId: string,
    @Param("compteId") compteId: string,
    @Body() dto: CreateRapprochementDto,
  ) {
    return this.comptes.creerRapprochement(shopId, compteId, dto);
  }
}
