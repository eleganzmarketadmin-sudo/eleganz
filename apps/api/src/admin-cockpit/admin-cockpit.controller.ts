import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { AdminCockpitService } from "./admin-cockpit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Écran Tableau de bord (PILOTAGE) — voir docs/ARCHITECTURE_FINANCE.md et
// l'audit du 18 oct. 2026 sur la granularité des rôles admin : chaque
// contrôleur admin exige désormais l'écran précis du Centre de pilotage
// auquel il correspond, plus seulement « être admin ».
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.PILOTAGE);
}

@Controller("admin/cockpit")
@UseGuards(JwtAuthGuard)
export class AdminCockpitController {
  constructor(private readonly cockpitService: AdminCockpitService) {}

  @Get("executive-dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.cockpitService.executiveDashboard();
  }

  @Get("evolution")
  evolution(@CurrentUser() user: AuthenticatedUser, @Query("days") days?: string) {
    requireAdmin(user);
    const n = days ? Math.min(Math.max(Number(days), 7), 90) : 30;
    return this.cockpitService.evolution(Number.isFinite(n) ? n : 30);
  }
}
