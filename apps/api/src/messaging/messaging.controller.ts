import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { DemarrerConversationDto, EnvoyerMessageDto } from "./dto/messaging.dto";

@Controller("messagerie")
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get("conversations")
  listerConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.listerConversations(user.id);
  }

  @Get("conversations/:id/messages")
  obtenirMessages(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.messaging.obtenirMessages(user.id, id);
  }

  @Post("conversations")
  demarrerConversation(@CurrentUser() user: AuthenticatedUser, @Body() dto: DemarrerConversationDto) {
    return this.messaging.demarrerConversation(user.id, dto.destinataireId, dto.subject, dto.message, dto.shopId);
  }

  @Post("conversations/:id/messages")
  envoyerMessage(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: EnvoyerMessageDto) {
    return this.messaging.envoyerMessage(user.id, id, dto.body);
  }

  @Post("conversations/:id/lu")
  marquerLu(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.messaging.marquerLu(user.id, id);
  }
}
