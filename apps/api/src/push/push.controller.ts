import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { PushSenderService } from "./push-sender.service";
import { PushSubscriptionsService } from "./push-subscriptions.service";
import { CreerAbonnementPushDto, SupprimerAbonnementPushDto } from "./dto/push-subscription.dto";

@Controller("push")
export class PushController {
  constructor(
    private readonly sender: PushSenderService,
    private readonly subscriptions: PushSubscriptionsService,
  ) {}

  // Public (pas de JwtAuthGuard) : juste une clé publique, nécessaire avant
  // même qu'il y ait un abonnement — c'est elle que le navigateur utilise
  // pour chiffrer sa demande d'abonnement (PushManager.subscribe).
  @Get("cle-publique")
  clePublique() {
    return { clePublique: this.sender.clePublique() };
  }

  @UseGuards(JwtAuthGuard)
  @Post("abonnement")
  abonner(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerAbonnementPushDto) {
    return this.subscriptions.abonner(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("abonnement")
  async desabonner(@CurrentUser() user: AuthenticatedUser, @Body() dto: SupprimerAbonnementPushDto) {
    await this.subscriptions.desabonner(user.id, dto.endpoint);
    return { ok: true };
  }
}
