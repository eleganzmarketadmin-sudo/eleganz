import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
}
