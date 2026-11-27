import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BoostService } from "./boost.service";
import { CreateBoostDto } from "./dto/create-boost.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, MenuAdmin } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

/**
 * Boost payant (26 nov. 2026) — mêmes gardes que ShopSubscriptionController :
 * OWNER/MANAGER peuvent consulter, seul OWNER engage la dépense (même
 * restriction que changerBouquetGestion, un boost reste un engagement
 * financier de la boutique).
 */
@Controller()
export class BoostController {
  constructor(private readonly boostService: BoostService) {}

  @Get("shops/:shopId/boosts")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  mesBoosts(@Param("shopId") shopId: string) {
    return this.boostService.mesBoosts(shopId);
  }

  @Post("shops/:shopId/boosts")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  acheter(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body() dto: CreateBoostDto,
  ) {
    return this.boostService.acheter(shopId, user.id, dto);
  }

  @Delete("shops/:shopId/boosts/:boostId")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  annuler(@Param("shopId") shopId: string, @Param("boostId") boostId: string) {
    return this.boostService.annuler(shopId, boostId);
  }

  // --- Centre de pilotage (visibilité opérationnelle + modération) ---
  // Déplacé le 27 nov. 2026 de MenuAdmin.TARIFS vers le nouveau
  // MenuAdmin.BOOST dédié (demande propriétaire : "créer un menu dans le
  // centre de pilotage où tout pourra être modifié").

  @Get("admin/boost")
  @UseGuards(JwtAuthGuard)
  listerEnCours(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostService.listerBoostsEnCours();
  }

  @Post("admin/boost/:boostId/revoquer")
  @UseGuards(JwtAuthGuard)
  revoquer(@CurrentUser() user: AuthenticatedUser, @Param("boostId") boostId: string) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostService.revoquer(boostId, user.id);
  }

  // Déclenchement manuel, même convention que les autres étapes du cycle de
  // facturation (admin/billing/run-*) — "chaque étape reste aussi
  // déclenchable manuellement" en attendant le prochain passage du cron
  // quotidien (3h du matin, voir CronJobsService).
  @Post("admin/boost/expirer-maintenant")
  @UseGuards(JwtAuthGuard)
  expirerMaintenant(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostService.expirerBoostsTermines();
  }
}
