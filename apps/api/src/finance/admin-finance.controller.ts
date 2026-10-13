import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminFinanceService } from "./admin-finance.service";
import { FiscalRulesService } from "./fiscal-rules.service";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

/**
 * FINANCE & COMPTABILITÉ — ELEGANZ elle-même (Centre de pilotage). Ces
 * routes ne prennent jamais de :shopId et ne touchent jamais les lignes
 * FiscalRule{scope:SHOP} — séparation imposée ici, pas seulement affichée
 * (voir docs/ARCHITECTURE_FINANCE.md §3.2 et §6).
 */
@Controller("admin/finance")
@UseGuards(JwtAuthGuard)
export class AdminFinanceController {
  constructor(
    private readonly adminFinanceService: AdminFinanceService,
    private readonly fiscalRulesService: FiscalRulesService,
  ) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    return this.adminFinanceService.dashboard(fromDate, toDate);
  }

  @Get("fiscal-rules")
  listFiscalRules(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.fiscalRulesService.listForPlatform();
  }

  @Get("fiscal-rules/:ruleId/versions")
  ruleVersions(@CurrentUser() user: AuthenticatedUser, @Param("ruleId") ruleId: string) {
    requireAdmin(user);
    return this.fiscalRulesService.versionsForPlatformRule(ruleId);
  }

  @Post("fiscal-rules")
  createFiscalRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFiscalRuleDto) {
    requireAdmin(user);
    return this.fiscalRulesService.createForPlatform(user.id, dto);
  }

  @Patch("fiscal-rules/:ruleId")
  updateFiscalRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateFiscalRuleDto,
  ) {
    requireAdmin(user);
    return this.fiscalRulesService.updateForPlatform(ruleId, user.id, dto);
  }
}
