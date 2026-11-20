import { Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // `espace` (optionnel) restreint les types renvoyés à ceux pertinents pour
  // ce portail (20 nov. 2026 — voir filtreTypeParEspace dans le service) ;
  // omis ou toute autre valeur que "livreur", le comportement est inchangé.
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("nonLues") nonLues?: string,
    @Query("espace") espace?: string,
  ) {
    return this.notifications.list(user.id, { nonLuesSeulement: nonLues === "true", espace });
  }

  @Get("compteur")
  async compteur(@CurrentUser() user: AuthenticatedUser, @Query("espace") espace?: string) {
    return { nonLues: await this.notifications.compterNonLues(user.id, espace) };
  }

  @Patch(":id/lue")
  marquerLue(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notifications.marquerLue(user.id, id);
  }

  @Post("tout-marquer-lu")
  toutMarquerLu(@CurrentUser() user: AuthenticatedUser, @Query("espace") espace?: string) {
    return this.notifications.marquerToutesLues(user.id, espace);
  }
}
