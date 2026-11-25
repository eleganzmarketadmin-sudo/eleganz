import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin, ShopModerationFlagStatus } from "@eleganz/database";
import { ModerationService } from "./moderation.service";
import { ResolveModerationFlagDto, CreateModerationTermDto, ISSUES_SIGNALEMENT } from "./dto/moderation.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

const STATUTS_VALIDES = Object.values(ShopModerationFlagStatus);

@Controller("admin/moderation")
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("signalements")
  listerSignalements(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    requireAdminMenu(user, MenuAdmin.MODERATION);
    if (status !== undefined && !STATUTS_VALIDES.includes(status as ShopModerationFlagStatus)) {
      throw new BadRequestException(`status doit être l'un de : ${STATUTS_VALIDES.join(", ")}.`);
    }
    return this.moderationService.listerSignalements(status as ShopModerationFlagStatus | undefined);
  }

  @Patch("signalements/:flagId")
  resoudreSignalement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("flagId") flagId: string,
    @Body() dto: ResolveModerationFlagDto,
  ) {
    requireAdminMenu(user, MenuAdmin.MODERATION);
    if (!ISSUES_SIGNALEMENT.includes(dto.status)) {
      throw new BadRequestException(`status doit être l'un de : ${ISSUES_SIGNALEMENT.join(", ")}.`);
    }
    return this.moderationService.resoudreSignalement(flagId, dto.status, dto.note, user.id);
  }

  @Get("termes")
  listerTermes(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.MODERATION);
    return this.moderationService.listerTermes();
  }

  @Post("termes")
  ajouterTerme(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateModerationTermDto) {
    requireAdminMenu(user, MenuAdmin.MODERATION);
    return this.moderationService.ajouterTerme(dto.term);
  }

  @Delete("termes/:termId")
  supprimerTerme(@CurrentUser() user: AuthenticatedUser, @Param("termId") termId: string) {
    requireAdminMenu(user, MenuAdmin.MODERATION);
    return this.moderationService.supprimerTerme(termId);
  }
}
