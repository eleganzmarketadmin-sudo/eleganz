import { Body, Controller, Delete, Get, Param, Put, Post, Query, UseGuards } from "@nestjs/common";
import { BoostAdminService } from "./boost-admin.service";
import { UpsertBoostCanalConfigDto, CreateBoostCoutExterneDto } from "./dto/boost-admin.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { BoostCanal, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

/**
 * Centre de pilotage ELEGANZ BOOST (27 nov. 2026) — canaux publicitaires
 * externes, coûts externes saisis manuellement, rapport de rentabilité.
 * Tout réservé à MenuAdmin.BOOST, même garde que BoostController/
 * BoostTarifsController.
 */
@Controller("admin/boost")
@UseGuards(JwtAuthGuard)
export class BoostAdminController {
  constructor(private readonly boostAdmin: BoostAdminService) {}

  @Get("canaux")
  listerCanaux(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.listerCanaux();
  }

  @Put("canaux/:canal")
  configurerCanal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("canal") canal: BoostCanal,
    @Body() dto: UpsertBoostCanalConfigDto,
  ) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.configurerCanal(canal, dto);
  }

  @Get("couts-externes")
  listerCoutsExternes(@CurrentUser() user: AuthenticatedUser, @Query("periode") periode?: string) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.listerCoutsExternes(periode);
  }

  @Post("couts-externes")
  ajouterCoutExterne(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBoostCoutExterneDto) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.ajouterCoutExterne(dto, user.id);
  }

  @Delete("couts-externes/:id")
  supprimerCoutExterne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.supprimerCoutExterne(id);
  }

  @Get("rapport")
  rapport(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostAdmin.rapportRentabilite(from, to);
  }
}
