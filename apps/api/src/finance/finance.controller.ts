import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FiscalRulesService } from "./fiscal-rules.service";
import { AccountingQueryService } from "./accounting-query.service";
import { ClosureService } from "./closure.service";
import { FiscalSimulationService } from "./fiscal-simulation.service";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";
import { UpdateFiscalIdentityDto } from "./dto/update-fiscal-identity.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, FiscalRuleScope } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

/**
 * FINANCE & COMPTABILITÉ — boutique (prompt du 13 oct. 2026). Lecture ouverte
 * à tout membre actif de la boutique ; écriture (charges déjà gérée par
 * ExpensesController, ici : règles fiscales) réservée à
 * OWNER/MANAGER/ACCOUNTANT — première utilisation réelle du rôle ACCOUNTANT,
 * jusqu'ici défini dans le schéma mais non câblé à aucune permission.
 */
@Controller("shops/:shopId/finance")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly fiscalRulesService: FiscalRulesService,
    private readonly accountingQuery: AccountingQueryService,
    private readonly closureService: ClosureService,
    private readonly fiscalSimulation: FiscalSimulationService,
  ) {}

  private periode(from?: string, to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    return { fromDate, toDate };
  }

  // Moteur de comptabilité en partie double (docs/ARCHITECTURE_FINANCE.md
  // §8bis) — lecture seule : les écritures sont générées automatiquement par
  // AccountingService à partir des opérations réelles, jamais saisies ici.
  @Get("journal")
  journal(
    @Param("shopId") shopId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("journal") journalCode?: string,
  ) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.journal(FiscalRuleScope.SHOP, shopId, fromDate, toDate, journalCode);
  }

  @Get("grand-livre")
  grandLivre(
    @Param("shopId") shopId: string,
    @Query("compte") compte: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.grandLivre(FiscalRuleScope.SHOP, shopId, compte, fromDate, toDate);
  }

  @Get("balance")
  balance(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.balance(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  // États financiers réglementaires simplifiés (docs/ARCHITECTURE_FINANCE.md
  // §8ter) — générés automatiquement à partir des mêmes écritures, jamais
  // un substitut à une liasse fiscale établie par un professionnel.
  @Get("compte-resultat")
  compteDeResultat(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.compteDeResultat(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  @Get("bilan")
  bilan(@Param("shopId") shopId: string, @Query("asOf") asOf?: string) {
    return this.accountingQuery.bilan(FiscalRuleScope.SHOP, shopId, asOf ? new Date(asOf) : new Date());
  }

  // Assistant de clôture (docs/ARCHITECTURE_FINANCE.md §8quinquies) —
  // verrouille un mois (plus aucune écriture acceptée) et fige un résumé.
  @Get("clotures")
  listClotures(@Param("shopId") shopId: string) {
    return this.closureService.list(FiscalRuleScope.SHOP, shopId);
  }

  @Post("clotures")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  cloturerPeriode(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body("periode") periode: string,
  ) {
    return this.closureService.close(FiscalRuleScope.SHOP, shopId, periode, user.id);
  }

  @Delete("clotures/:periode")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  reouvrirPeriode(@Param("shopId") shopId: string, @Param("periode") periode: string) {
    return this.closureService.reopen(FiscalRuleScope.SHOP, shopId, periode);
  }

  // Simulation fiscale (docs/ARCHITECTURE_FINANCE.md §8septies) — jamais
  // une déclaration officielle, toujours un ordre de grandeur.
  @Get("simulation-fiscale")
  simulationFiscale(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.fiscalSimulation.simulerShop(shopId, fromDate, toDate);
  }

  // Analytique et prévisions (docs/ARCHITECTURE_FINANCE.md §8octies) —
  // évolution mensuelle réelle, projection calculée côté client (moyenne
  // mobile), toujours étiquetée comme estimation.
  @Get("analytique")
  analytique(@Param("shopId") shopId: string, @Query("mois") mois?: string) {
    const nombreMois = Math.min(Math.max(Number(mois) || 6, 1), 24);
    return this.accountingQuery.evolutionMensuelle(FiscalRuleScope.SHOP, shopId, nombreMois);
  }

  // Relevé de trésorerie réel par devise (docs/ARCHITECTURE_FINANCE.md
  // §8nonies) — soldes et mouvements réels des comptes 5711/5712.
  @Get("tresorerie")
  tresorerie(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.releveTresorerie(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  @Get("fiscal-identity")
  fiscalIdentity(@Param("shopId") shopId: string) {
    return this.financeService.fiscalIdentity(shopId);
  }

  @Patch("fiscal-identity")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  updateFiscalIdentity(@Param("shopId") shopId: string, @Body() dto: UpdateFiscalIdentityDto) {
    return this.financeService.updateFiscalIdentity(shopId, dto);
  }

  @Get("dashboard")
  dashboard(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    return this.financeService.dashboardForShop(shopId, fromDate, toDate);
  }

  @Get("fiscal-rules")
  listFiscalRules(@Param("shopId") shopId: string) {
    return this.fiscalRulesService.listForShop(shopId);
  }

  @Get("fiscal-rules/:ruleId/versions")
  ruleVersions(@Param("shopId") shopId: string, @Param("ruleId") ruleId: string) {
    return this.fiscalRulesService.versionsForShopRule(shopId, ruleId);
  }

  @Post("fiscal-rules")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  createFiscalRule(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFiscalRuleDto,
  ) {
    return this.fiscalRulesService.createForShop(shopId, user.id, dto);
  }

  @Patch("fiscal-rules/:ruleId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  updateFiscalRule(
    @Param("shopId") shopId: string,
    @Param("ruleId") ruleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFiscalRuleDto,
  ) {
    return this.fiscalRulesService.updateForShop(shopId, ruleId, user.id, dto);
  }

  @Delete("fiscal-rules/:ruleId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  archiveFiscalRule(
    @Param("shopId") shopId: string,
    @Param("ruleId") ruleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body("motif") motif: string,
  ) {
    return this.fiscalRulesService.archiveForShop(shopId, ruleId, user.id, motif || "Archivage");
  }
}
