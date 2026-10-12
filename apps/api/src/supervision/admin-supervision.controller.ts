import { Controller, ForbiddenException, Get, Query, UseGuards } from "@nestjs/common";
import { SupervisionService } from "./supervision.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

/**
 * Suivi des commandes/paiements et comportement des acteurs pour le Centre
 * de pilotage (demande du 12 oct. 2026, point 4) — jusqu'ici l'admin ne
 * pouvait voir ni les commandes en cours à l'échelle de la plateforme, ni
 * repérer une boutique ou un livreur systématiquement lent.
 */
@Controller("admin/supervision")
@UseGuards(JwtAuthGuard)
export class AdminSupervisionController {
  constructor(private readonly supervisionService: SupervisionService) {}

  @Get("commandes-en-cours")
  commandesEnCours(@CurrentUser() user: AuthenticatedUser, @Query("shopId") shopId?: string) {
    requireAdmin(user);
    return this.supervisionService.commandesEnCours(shopId || undefined);
  }

  @Get("boutiques")
  comportementBoutiques(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.supervisionService.comportementBoutiques();
  }

  @Get("livreurs")
  comportementLivreurs(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.supervisionService.comportementLivreurs();
  }
}
