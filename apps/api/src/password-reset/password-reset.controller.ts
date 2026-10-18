import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PasswordResetService } from "./password-reset.service";
import {
  DemanderReinitialisationDto,
  ResoudreReinitialisationDto,
  VerifierCodeReinitialisationDto,
} from "./dto/password-reset.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { PasswordResetRequestStatus, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Écran Utilisateurs (UTILISATEURS) — voir audit du 18 oct. 2026.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.UTILISATEURS);
}

// Point d'entrée public : n'importe qui ayant oublié son mot de passe
// (tout espace confondu — Marketplace, Gestion, Livreur, Centre de
// pilotage) peut solliciter l'admin sans être connecté.
@Controller("mot-de-passe-oublie")
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Post()
  demander(@Body() dto: DemanderReinitialisationDto) {
    return this.passwordReset.demanderReinitialisation(dto.identifiant, dto.message);
  }

  // Auto-service complet (16 oct. 2026) : code reçu par email/WhatsApp +
  // nouveau mot de passe en un seul appel, sans admin.
  @Post("verifier")
  verifier(@Body() dto: VerifierCodeReinitialisationDto) {
    return this.passwordReset.verifierCode(dto.identifiant, dto.code, dto.newPassword);
  }
}

// Traitement des demandes depuis le Centre de pilotage — même garde que
// AdminUsersController (n'importe quel compte ADMIN_*, pas seulement
// ADMIN_SUPER : réinitialiser un mot de passe à la demande fait partie du
// dépannage de compte déjà ouvert à tout admin).
@Controller("admin/password-reset-requests")
@UseGuards(JwtAuthGuard)
export class AdminPasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: PasswordResetRequestStatus) {
    requireAdmin(user);
    return this.passwordReset.lister(status);
  }

  @Post(":id/resoudre")
  resoudre(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResoudreReinitialisationDto,
  ) {
    requireAdmin(user);
    return this.passwordReset.resoudre(id, user.id, dto.newPassword);
  }

  @Post(":id/rejeter")
  rejeter(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    requireAdmin(user);
    return this.passwordReset.rejeter(id, user.id);
  }
}
