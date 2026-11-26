import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { BoostTarifsService } from "./boost-tarifs.service";
import { CreateBoostTarifDto, UpdateBoostTarifDto } from "./dto/boost-tarif.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { BoostCible, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

/**
 * Tarifs Boost (26 nov. 2026) — même structure que
 * SubscriptionPlansController : lecture publique (l'écran d'achat côté
 * Gestion en a besoin sans etre admin), écriture réservée à MenuAdmin.TARIFS.
 */
@Controller()
export class BoostTarifsController {
  constructor(private readonly boostTarifsService: BoostTarifsService) {}

  @Get("billing/boost-tarifs")
  list(@Query("cible") cible?: BoostCible) {
    return this.boostTarifsService.list(cible);
  }

  @Get("admin/billing/boost-tarifs")
  @UseGuards(JwtAuthGuard)
  listAll(@CurrentUser() user: AuthenticatedUser, @Query("cible") cible?: BoostCible) {
    requireAdminMenu(user, MenuAdmin.TARIFS);
    return this.boostTarifsService.listAll(cible);
  }

  @Post("admin/billing/boost-tarifs")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBoostTarifDto) {
    requireAdminMenu(user, MenuAdmin.TARIFS);
    return this.boostTarifsService.create(dto);
  }

  @Patch("admin/billing/boost-tarifs/:tarifId")
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tarifId") tarifId: string,
    @Body() dto: UpdateBoostTarifDto,
  ) {
    requireAdminMenu(user, MenuAdmin.TARIFS);
    return this.boostTarifsService.update(tarifId, dto);
  }
}
