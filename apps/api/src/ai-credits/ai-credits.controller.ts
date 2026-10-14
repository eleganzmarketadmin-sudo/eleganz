import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AiCreditsService } from "./ai-credits.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateAiServiceDto, UpdateAiServiceDto } from "./dto/ai-service.dto";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

@Controller()
export class AiCreditsController {
  constructor(private readonly aiCreditsService: AiCreditsService) {}

  // Catalogue public des services IA consommant des crédits (coût en
  // crédits uniquement) — pas d'authentification requise pour l'afficher.
  @Get("ai-credits/services")
  listActiveServices() {
    return this.aiCreditsService.listActiveServices();
  }

  @Get("shops/:shopId/ai-credits/wallet")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  getWallet(@Param("shopId") shopId: string) {
    return this.aiCreditsService.getWallet(shopId);
  }

  @Post("shops/:shopId/ai-credits/top-up")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  requestTopUp(@Param("shopId") shopId: string, @Body("quantity") quantity: number) {
    return this.aiCreditsService.requestTopUp(shopId, Number(quantity));
  }

  @Get("admin/ai-credits/services")
  @UseGuards(JwtAuthGuard)
  adminListServices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.aiCreditsService.adminListServices();
  }

  @Post("admin/ai-credits/services")
  @UseGuards(JwtAuthGuard)
  adminCreateService(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAiServiceDto) {
    requireAdmin(user);
    return this.aiCreditsService.adminCreateService(dto);
  }

  @Patch("admin/ai-credits/services/:id")
  @UseGuards(JwtAuthGuard)
  adminUpdateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAiServiceDto,
  ) {
    requireAdmin(user);
    return this.aiCreditsService.adminUpdateService(id, dto);
  }

  @Get("admin/ai-credits/top-ups")
  @UseGuards(JwtAuthGuard)
  listPendingTopUps(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.aiCreditsService.listPendingTopUps();
  }

  @Post("admin/ai-credits/top-ups/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markTopUpPaidAndGrant(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user);
    return this.aiCreditsService.markTopUpPaidAndGrant(invoiceId);
  }
}
