import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { BoostTarifsService } from "./boost-tarifs.service";
import { CreateBoostTarifDto, UpdateBoostTarifDto } from "./dto/boost-tarif.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { BoostCible, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

/**
 * Tarifs Boost (26 nov. 2026 ; étendu le 27 nov. 2026, refonte ELEGANZ
 * BOOST) — même structure que SubscriptionPlansController : lecture
 * publique (l'écran d'achat côté Gestion en a besoin sans être admin),
 * écriture réservée au nouveau menu dédié MenuAdmin.BOOST (déplacé de
 * MenuAdmin.TARIFS — demande propriétaire : "créer un menu... où tout
 * pourra être modifié").
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
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostTarifsService.listAll(cible);
  }

  @Post("admin/billing/boost-tarifs")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBoostTarifDto) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostTarifsService.create(dto);
  }

  @Patch("admin/billing/boost-tarifs/:tarifId")
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tarifId") tarifId: string,
    @Body() dto: UpdateBoostTarifDto,
  ) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostTarifsService.update(tarifId, dto);
  }
}
