import { Controller, ForbiddenException, Get, Query, UseGuards } from "@nestjs/common";
import { AdminCockpitService } from "./admin-cockpit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
