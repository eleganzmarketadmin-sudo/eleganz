import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { PlanCategory, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// La lecture de la liste des bouquets est aussi utilisée en lecture depuis
// l'écran Boutiques (pour afficher le plan d'une boutique) — d'où le double
// menu accepté sur listAll. La création/modification reste propre à l'écran
// Tarifs (audit du 18 oct. 2026).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin | MenuAdmin[]) {
  requireAdminMenu(user, menu);
}

@Controller()
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  // Public : un vendeur doit pouvoir consulter les bouquets disponibles sans
  // être connecté (page tarifs), d'où l'absence de guard sur cette route.
  @Get("billing/plans")
  list(@Query("category") category?: PlanCategory) {
    return this.plansService.list(category);
  }

  @Get("admin/billing/plans")
  @UseGuards(JwtAuthGuard)
  listAll(@CurrentUser() user: AuthenticatedUser, @Query("category") category?: PlanCategory) {
    requireAdmin(user, [MenuAdmin.TARIFS, MenuAdmin.BOUTIQUES]);
    return this.plansService.listAll(category);
  }

  @Post("admin/billing/plans")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionPlanDto) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.plansService.create(dto);
  }

  @Patch("admin/billing/plans/:planId")
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("planId") planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.plansService.update(planId, dto);
  }
}
