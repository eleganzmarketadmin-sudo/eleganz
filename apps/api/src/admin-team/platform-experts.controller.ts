import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PlatformExpertsService } from "./platform-experts.service";
import { InvitePlatformExpertDto } from "./dto/platform-expert.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireSuperAdmin } from "./admin-team.controller";

/**
 * Gestion des accès experts externes à l'échelle plateforme (16 oct. 2026,
 * point 2 — "ajouter le bloc d'invitation Experts externes... comme déjà
 * actif dans eleganz gestion") : réservée à ADMIN_SUPER, par le même
 * principe que la gestion de l'équipe admin elle-même — accorder un accès
 * en lecture à des écrans du Centre de pilotage est tout aussi sensible que
 * d'y accorder un rôle.
 */
@Controller("admin/experts")
@UseGuards(JwtAuthGuard)
export class AdminExpertsController {
  constructor(private readonly experts: PlatformExpertsService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    requireSuperAdmin(user);
    return this.experts.listEngagements();
  }

  @Get("invitations")
  listerInvites(@CurrentUser() user: AuthenticatedUser) {
    requireSuperAdmin(user);
    return this.experts.listInvites();
  }

  @Post("invitations")
  creerInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InvitePlatformExpertDto) {
    requireSuperAdmin(user);
    return this.experts.creerInvite(user.id, dto);
  }

  @Delete("invitations/:inviteId")
  revoquerInvite(@CurrentUser() user: AuthenticatedUser, @Param("inviteId") inviteId: string) {
    requireSuperAdmin(user);
    return this.experts.revoquerInvite(inviteId);
  }

  @Delete(":engagementId")
  revoquerEngagement(@CurrentUser() user: AuthenticatedUser, @Param("engagementId") engagementId: string) {
    requireSuperAdmin(user);
    return this.experts.revoquerEngagement(engagementId);
  }
}

/**
 * Aperçu public d'un lien d'invitation expert plateforme, et acceptation
 * (compte ELEGANZ déjà connecté requis) — même découpage que
 * ExpertsController/ShopExpertsController : ces deux routes ne sont PAS
 * réservées à un admin, puisque c'est l'expert invité (souvent sans aucun
 * rôle admin) qui les appelle.
 */
@Controller("experts/plateforme")
export class PlatformExpertInvitesController {
  constructor(private readonly experts: PlatformExpertsService) {}

  @Get("invitations/:token")
  apercu(@Param("token") token: string) {
    return this.experts.apercuInvite(token);
  }

  @Post("invitations/:token/accepter")
  @UseGuards(JwtAuthGuard)
  accepter(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string) {
    return this.experts.accepterInvite(token, user.id);
  }
}
