import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { ShopStatus, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// La liste des boutiques est aussi lue depuis l'écran Relevés (pour filtrer
// un relevé par boutique) — d'où le double menu accepté sur `list`. Les
// actions qui modifient une boutique restent propres à l'écran Boutiques
// (audit du 18 oct. 2026).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin | MenuAdmin[]) {
  requireAdminMenu(user, menu);
}

/**
 * Gestion de plateforme (prompt §40) : lister les boutiques/vendeurs et
 * agir sur leur statut (suspension, réactivation) ou leur bouquet tarifaire
 * sans écrire de code — contrairement à BillingService.suspendOverdueShops
 * (traitement en masse des retards), ici l'admin cible UNE boutique précise
 * pour n'importe quelle raison (litige, demande du vendeur, etc.).
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AdminShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get("admin/shops")
  list(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, [MenuAdmin.BOUTIQUES, MenuAdmin.RELEVES]);
    return this.shopsService.adminListAll();
  }

  @Post("admin/shops/:shopId/suspend")
  suspend(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string) {
    requireAdmin(user, MenuAdmin.BOUTIQUES);
    return this.shopsService.adminSetStatus(shopId, ShopStatus.SUSPENDED);
  }

  @Post("admin/shops/:shopId/reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string) {
    requireAdmin(user, MenuAdmin.BOUTIQUES);
    return this.shopsService.adminSetStatus(shopId, ShopStatus.ACTIVE);
  }

  @Patch("admin/shops/:shopId/plan")
  setPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body("kind") kind: "gestion" | "marketplace",
    @Body("planId") planId: string | null,
  ) {
    requireAdmin(user, MenuAdmin.BOUTIQUES);
    return this.shopsService.adminSetPlan(shopId, kind, planId);
  }

  /**
   * Confirme manuellement l'homologation DGI d'une boutique, une fois les
   * démarches effectuées hors plateforme — c'est ce qui débloque la facture
   * fiscale homologuée pour cette boutique (demande du 12 oct. 2026, n°3).
   */
  @Patch("admin/shops/:shopId/fiscal-homologation")
  setFiscalHomologation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body("confirmed") confirmed: boolean,
  ) {
    requireAdmin(user, MenuAdmin.BOUTIQUES);
    return this.shopsService.adminSetFiscalHomologation(shopId, Boolean(confirmed));
  }
}
