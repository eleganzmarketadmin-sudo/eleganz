import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { ComptablePlansService } from "./comptable-plans.service";
import { CreateComptablePlanDto, UpdateComptablePlanDto } from "./dto/comptable-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Gestion des bouquets Secourable depuis l'écran Tarifs (TARIFS) — voir
// audit du 18 oct. 2026.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.TARIFS);
}

@Controller()
export class ComptablePlansController {
  constructor(private readonly plansService: ComptablePlansService) {}

  // Public, sans authentification : un visiteur doit pouvoir comparer les
  // bouquets avant même de créer un compte (même logique que
  // SubscriptionPlansController.list côté ELEGANZ Gestion/Marketplace, et
  // que publicComptablePricing — qui reste en place pour l'écran
  // d'inscription actuel, ce nouvel endpoint donnant le détail par bouquet).
  @Get("comptable/plans")
  list() {
    return this.plansService.list();
  }

  @Get("admin/comptable/plans")
  @UseGuards(JwtAuthGuard)
  listAll(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.plansService.listAll();
  }

  @Post("admin/comptable/plans")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateComptablePlanDto) {
    requireAdmin(user);
    return this.plansService.create(dto);
  }

  @Patch("admin/comptable/plans/:planId")
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthenticatedUser, @Param("planId") planId: string, @Body() dto: UpdateComptablePlanDto) {
    requireAdmin(user);
    return this.plansService.update(planId, dto);
  }
}
