import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { PlanCategory } from "@eleganz/database";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
    requireAdmin(user);
    return this.plansService.listAll(category);
  }

  @Post("admin/billing/plans")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionPlanDto) {
    requireAdmin(user);
    return this.plansService.create(dto);
  }

  @Patch("admin/billing/plans/:planId")
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("planId") planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    requireAdmin(user);
    return this.plansService.update(planId, dto);
  }
}
