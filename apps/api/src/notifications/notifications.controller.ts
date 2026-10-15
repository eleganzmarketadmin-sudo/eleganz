import { Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("nonLues") nonLues?: string) {
    return this.notifications.list(user.id, { nonLuesSeulement: nonLues === "true" });
  }

  @Get("compteur")
  async compteur(@CurrentUser() user: AuthenticatedUser) {
    return { nonLues: await this.notifications.compterNonLues(user.id) };
  }

  @Patch(":id/lue")
  marquerLue(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notifications.marquerLue(user.id, id);
  }

  @Post("tout-marquer-lu")
  toutMarquerLu(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.marquerToutesLues(user.id);
  }
}
