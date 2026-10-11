import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { AdminCockpitService } from "./admin-cockpit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("admin/cockpit")
@UseGuards(JwtAuthGuard)
export class AdminCockpitController {
  constructor(private readonly cockpitService: AdminCockpitService) {}

  @Get("executive-dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    if (!user.role.startsWith("ADMIN_")) {
      throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
    }
    return this.cockpitService.executiveDashboard();
  }
}
