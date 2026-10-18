import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { AdminSettingsService } from "./admin-settings.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Ce contrôleur générique sert à la fois l'écran Paramètres plateforme
// (PARAMETRES_PLATEFORME) et les champs tarifaires exposés depuis l'écran
// Tarifs (TARIFS, ex. taux de change) — voir audit du 18 oct. 2026 : un seul
// des deux suffit, pour ne pas retirer à un admin Tarifs un accès qu'il a
// déjà aujourd'hui via cet écran.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, [MenuAdmin.PARAMETRES_PLATEFORME, MenuAdmin.TARIFS]);
}

/**
 * Coordonnées officielles de la plateforme, modifiables depuis le Centre
 * de pilotage (prompt du 12 oct. 2026) — adresse, site web, contact,
 * réseaux sociaux.
 */
@Controller("admin/platform-settings")
@UseGuards(JwtAuthGuard)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.adminSettingsService.get();
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePlatformSettingsDto) {
    requireAdmin(user);
    return this.adminSettingsService.update(dto);
  }

  // Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) — un
  // seul taux pour toute la plateforme, modifiable uniquement ici (Centre de
  // pilotage) ; chaque changement garde une trace dans ExchangeRateHistory.
  @Patch("exchange-rate")
  updateExchangeRate(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateExchangeRateDto) {
    requireAdmin(user);
    return this.adminSettingsService.updateExchangeRate(dto.cdfPerUsd, user.id);
  }

  @Get("exchange-rate-history")
  exchangeRateHistory(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.adminSettingsService.exchangeRateHistory();
  }
}
