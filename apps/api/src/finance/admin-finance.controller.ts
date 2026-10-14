import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AdminFinanceService } from "./admin-finance.service";
import { FiscalRulesService } from "./fiscal-rules.service";
import { AccountingQueryService } from "./accounting-query.service";
import { ClosureService } from "./closure.service";
import { DossierValidationService } from "./dossier-validation.service";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { FiscalRuleScope } from "@eleganz/database";

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
    private readonly accountingQuery: AccountingQueryService,
    private readonly closureService: ClosureService,
    private readonly dossierValidation: DossierValidationService,
  ) {}

  private periode(from?: string, to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    return { fromDate, toDate };
  }

  // Moteur comptable ELEGANZ (scope PLATFORM uniquement — jamais de
  // :shopId sur ces routes, voir docs/ARCHITECTURE_FINANCE.md §8bis.5/§6).
  @Get("journal")
  journal(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("journal") journalCode?: string,
  ) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.journal(FiscalRuleScope.PLATFORM, null, fromDate, toDate, journalCode);
  }

  @Get("grand-livre")
  grandLivre(
    @CurrentUser() user: AuthenticatedUser,
    @Query("compte") compte: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.grandLivre(FiscalRuleScope.PLATFORM, null, compte, fromDate, toDate);
  }

  @Get("balance")
  balance(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.balance(FiscalRuleScope.PLATFORM, null, fromDate, toDate);
  }

  @Get("compte-resultat")
  compteDeResultat(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.compteDeResultat(FiscalRuleScope.PLATFORM, null, fromDate, toDate);
  }

  @Get("bilan")
  bilan(@CurrentUser() user: AuthenticatedUser, @Query("asOf") asOf?: string) {
    requireAdmin(user);
    return this.accountingQuery.bilan(FiscalRuleScope.PLATFORM, null, asOf ? new Date(asOf) : new Date());
  }

  // États normalisés SYSCOHADA — ELEGANZ elle-même (chantier réactivé,
  // phase 6, 14 oct. 2026) : la comptabilité de la plateforme est tenue
  // jusqu'au sens SYSCOHADA/OHADA (obligatoire ici, jamais une option —
  // voir prompt du 14 oct. 2026 point 2). Mêmes réserves que côté boutique :
  // "avant impôt sur les bénéfices", estimation de pilotage à faire valider
  // par un expert-comptable externe.
  @Get("bilan-normalise")
  bilanNormalise(@CurrentUser() user: AuthenticatedUser, @Query("asOf") asOf?: string) {
    requireAdmin(user);
    return this.accountingQuery.bilanNormalise(FiscalRuleScope.PLATFORM, null, asOf ? new Date(asOf) : new Date());
  }

  @Get("compte-resultat-normalise")
  compteDeResultatNormalise(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.compteDeResultatNormalise(FiscalRuleScope.PLATFORM, null, fromDate, toDate);
  }

  // Dossier de validation externe SYSCOHADA — ELEGANZ elle-même (chantier
  // réactivé, phase 7, 14 oct. 2026). Même classeur multi-feuilles que côté
  // boutique, scope PLATFORM, réservé à l'administration.
  @Get("dossier-validation")
  async dossierValidationExterne(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    requireAdmin(user);
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), 0, 1);
    const { buffer, nomFichier } = await this.dossierValidation.genererClasseur(FiscalRuleScope.PLATFORM, null, fromDate, toDate);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}"`);
    return res.send(buffer);
  }

  @Get("analytique")
  analytique(@CurrentUser() user: AuthenticatedUser, @Query("mois") mois?: string) {
    requireAdmin(user);
    const nombreMois = Math.min(Math.max(Number(mois) || 6, 1), 24);
    return this.accountingQuery.evolutionMensuelle(FiscalRuleScope.PLATFORM, null, nombreMois);
  }

  @Get("tresorerie")
  tresorerie(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.releveTresorerie(FiscalRuleScope.PLATFORM, null, fromDate, toDate);
  }

  @Get("clotures")
  listClotures(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.closureService.list(FiscalRuleScope.PLATFORM, null);
  }

  @Post("clotures")
  cloturerPeriode(@CurrentUser() user: AuthenticatedUser, @Body("periode") periode: string) {
    requireAdmin(user);
    return this.closureService.close(FiscalRuleScope.PLATFORM, null, periode, user.id);
  }

  @Delete("clotures/:periode")
  reouvrirPeriode(@CurrentUser() user: AuthenticatedUser, @Param("periode") periode: string) {
    requireAdmin(user);
    return this.closureService.reopen(FiscalRuleScope.PLATFORM, null, periode);
  }

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
