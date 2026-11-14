import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminInstitutionsService } from "./admin-institutions.service";
import { CreateInstitutionDto, UpdateInstitutionDto, RejectInstitutionDto } from "./dto/admin-institutions.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireSuperAdmin } from "../admin-team/admin-team.controller";

// Réservé à ADMIN_SUPER, même restriction et même raison que
// AdminTeamController (requireSuperAdmin) : cet écran attribue un rôle
// (INSTITUTION_STAFF) à un compte, ce qui doit rester aussi verrouillé que
// l'attribution d'un rôle admin.
@Controller("admin/institutions")
@UseGuards(JwtAuthGuard)
export class AdminInstitutionsController {
  constructor(private readonly adminInstitutions: AdminInstitutionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    requireSuperAdmin(user);
    return this.adminInstitutions.list();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstitutionDto) {
    requireSuperAdmin(user);
    return this.adminInstitutions.create(dto);
  }

  @Patch(":institutionId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("institutionId") institutionId: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    requireSuperAdmin(user);
    return this.adminInstitutions.update(institutionId, dto);
  }

  @Post(":institutionId/suspend")
  suspend(@CurrentUser() user: AuthenticatedUser, @Param("institutionId") institutionId: string) {
    requireSuperAdmin(user);
    return this.adminInstitutions.setStatus(institutionId, "SUSPENDED");
  }

  @Post(":institutionId/reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param("institutionId") institutionId: string) {
    requireSuperAdmin(user);
    return this.adminInstitutions.setStatus(institutionId, "ACTIVE");
  }

  // Refus d'une auto-inscription (14 nov. 2026) — distinct de /suspend, voir
  // le commentaire sur AdminInstitutionsService.reject.
  @Post(":institutionId/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("institutionId") institutionId: string,
    @Body() dto: RejectInstitutionDto,
  ) {
    requireSuperAdmin(user);
    return this.adminInstitutions.reject(institutionId, dto.note);
  }
}
