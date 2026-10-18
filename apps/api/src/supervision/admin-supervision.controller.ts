import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { SupervisionService } from "./supervision.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// comportementLivreurs est lu depuis l'écran Livreurs ET l'écran Suivi des
// commandes — d'où le double menu accepté sur cette route précise (audit du
// 18 oct. 2026).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin | MenuAdmin[]) {
  requireAdminMenu(user, menu);
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
    requireAdmin(user, MenuAdmin.SUIVI_COMMANDES);
    return this.supervisionService.commandesEnCours(shopId || undefined);
  }

  @Get("boutiques")
  comportementBoutiques(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.SUIVI_COMMANDES);
    return this.supervisionService.comportementBoutiques();
  }

  @Get("livreurs")
  comportementLivreurs(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, [MenuAdmin.LIVREURS, MenuAdmin.SUIVI_COMMANDES]);
    return this.supervisionService.comportementLivreurs();
  }
}
