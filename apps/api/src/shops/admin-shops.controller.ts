import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { ShopStatus } from "@eleganz/database";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
    requireAdmin(user);
    return this.shopsService.adminListAll();
  }

  @Post("admin/shops/:shopId/suspend")
  suspend(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string) {
    requireAdmin(user);
    return this.shopsService.adminSetStatus(shopId, ShopStatus.SUSPENDED);
  }

  @Post("admin/shops/:shopId/reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string) {
    requireAdmin(user);
    return this.shopsService.adminSetStatus(shopId, ShopStatus.ACTIVE);
  }

  @Patch("admin/shops/:shopId/plan")
  setPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body("kind") kind: "gestion" | "marketplace",
    @Body("planId") planId: string | null,
  ) {
    requireAdmin(user);
    return this.shopsService.adminSetPlan(shopId, kind, planId);
  }
}
