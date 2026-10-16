import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminTeamService } from "./admin-team.service";
import { GrantAdminRoleDto, UpdateAdminDto } from "./dto/admin-team.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

// Gérer QUI est admin — et désormais quels écrans précis chaque admin peut
// ouvrir (16 oct. 2026 — "donner la main aux users super administrateur
// l'accès au menu équipe et la possibilité de choisir par des coches") —
// est volontairement réservé à ADMIN_SUPER seul, pas à "n'importe quel
// admin" comme avant cette demande : un compte Ventes ou Finance ne doit
// pas pouvoir, via cet écran, se donner à lui-même ou donner à un tiers un
// rôle plus large que celui qu'on lui a confié.
function requireSuperAdmin(user: AuthenticatedUser) {
  if (user.role !== "ADMIN_SUPER") {
    throw new ForbiddenException("Réservé aux super administrateurs ELEGANZ.");
  }
}

/**
 * Permet à un super administrateur d'ajouter, modifier ou retirer d'autres
 * administrateurs depuis le centre de pilotage — sans cela, seule une
 * intervention directe en base de données permettrait d'accorder un accès
 * admin à quelqu'un d'autre que le premier compte créé.
 */
@Controller("admin/team")
@UseGuards(JwtAuthGuard)
export class AdminTeamController {
  constructor(private readonly adminTeamService: AdminTeamService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    requireSuperAdmin(user);
    return this.adminTeamService.listAdmins();
  }

  // Écrans par défaut de chaque rôle admin — sert à pré-remplir les cases à
  // cocher à l'attribution, côté écran Équipe admin.
  @Get("defauts-menu")
  defautsMenu(@CurrentUser() user: AuthenticatedUser) {
    requireSuperAdmin(user);
    return this.adminTeamService.defautsParRole();
  }

  @Post("grant")
  grant(@CurrentUser() user: AuthenticatedUser, @Body() dto: GrantAdminRoleDto) {
    requireSuperAdmin(user);
    return this.adminTeamService.grantAdminRole(dto.identifiant, dto.role, dto.menuItems);
  }

  // Modifier le rôle et/ou les écrans d'un admin déjà promu (16 oct. 2026)
  // — n'existait pas avant : seules la promotion et la révocation étaient
  // possibles.
  @Patch(":userId")
  update(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string, @Body() dto: UpdateAdminDto) {
    requireSuperAdmin(user);
    return this.adminTeamService.updateAdmin(userId, dto.role, dto.menuItems);
  }

  @Post(":userId/revoke")
  revoke(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    requireSuperAdmin(user);
    return this.adminTeamService.revokeAdminRole(userId, user.id);
  }
}
