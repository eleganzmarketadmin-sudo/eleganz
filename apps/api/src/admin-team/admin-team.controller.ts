import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AdminTeamService } from "./admin-team.service";
import { GrantAdminRoleDto } from "./dto/admin-team.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

/**
 * Permet à un administrateur d'ajouter ou retirer d'autres administrateurs
 * depuis le centre de pilotage — sans cela, seule une intervention directe
 * en base de données permettrait d'accorder un accès admin à quelqu'un
 * d'autre que le premier compte créé.
 */
@Controller("admin/team")
@UseGuards(JwtAuthGuard)
export class AdminTeamController {
  constructor(private readonly adminTeamService: AdminTeamService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.adminTeamService.listAdmins();
  }

  @Post("grant")
  grant(@CurrentUser() user: AuthenticatedUser, @Body() dto: GrantAdminRoleDto) {
    requireAdmin(user);
    return this.adminTeamService.grantAdminRole(dto.identifiant, dto.role);
  }

  @Post(":userId/revoke")
  revoke(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    requireAdmin(user);
    return this.adminTeamService.revokeAdminRole(userId, user.id);
  }
}
