import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { ChangeGestionPlanDto } from "./dto/change-gestion-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";

/**
 * Abonnement Gestion en libre-service (16 oct. 2026, demande du
 * propriétaire ELEGANZ, point 1 des propositions du 16 oct. 2026) —
 * volontairement limité au bouquet GESTION : le bouquet Marketplace reste
 * un changement réservé à l'administration (/admin/boutiques) à ce stade.
 * Toute l'équipe habilitée aux paramètres de la boutique peut consulter
 * (OWNER, MANAGER — mêmes rôles que /shops/:shopId/invoice-settings), mais
 * seul le propriétaire peut changer de bouquet : c'est un engagement
 * financier pour la boutique, pas un simple réglage d'affichage.
 */
@Controller("shops/:shopId/subscription")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ShopSubscriptionController {
  constructor(private readonly billing: BillingService) {}

  @Get("gestion")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  getStatutGestion(@Param("shopId") shopId: string) {
    return this.billing.getStatutAbonnementGestion(shopId);
  }

  @Post("gestion/change")
  @ShopRoles(StaffRole.OWNER)
  changerBouquetGestion(@Param("shopId") shopId: string, @Body() dto: ChangeGestionPlanDto) {
    return this.billing.changerBouquetGestion(shopId, dto.planId);
  }
}
