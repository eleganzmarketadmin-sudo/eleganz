import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { AdminSettingsService } from "./admin-settings.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import { RequestPlatformLogoUploadDto } from "./dto/request-platform-logo-upload.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Ce contrôleur générique sert à la fois l'écran Paramètres plateforme
// (PARAMETRES_PLATEFORME), les champs tarifaires exposés depuis l'écran
// Tarifs (TARIFS, ex. taux de change) et, depuis le 27 nov. 2026, les
// réglages Boost (emplacements/priorités, promotions de lancement, taux de
// charges directes) exposés depuis le nouveau menu BOOST — voir audit du
// 18 oct. 2026 : un seul des trois suffit, pour ne pas retirer à un admin
// d'un menu un accès qu'il a déjà aujourd'hui via cet écran.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, [MenuAdmin.PARAMETRES_PLATEFORME, MenuAdmin.TARIFS, MenuAdmin.BOOST]);
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

  // URL signée d'upload direct du logo plateforme vers R2 (20 nov. 2026,
  // même principe que les autres écrans Paramètres) — le navigateur PUT
  // ensuite le fichier directement sur R2, puis PATCH ci-dessus avec l'URL
  // publique obtenue.
  @Post("logo-upload-url")
  creerUrlUploadLogo(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPlatformLogoUploadDto) {
    requireAdmin(user);
    return this.adminSettingsService.creerUrlUploadLogo(dto.contentType);
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
