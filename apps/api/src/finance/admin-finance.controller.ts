import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AdminFinanceService } from "./admin-finance.service";
import { AccountingService } from "./accounting.service";
import { FiscalRulesService } from "./fiscal-rules.service";
import { AccountingQueryService } from "./accounting-query.service";
import { ClosureService } from "./closure.service";
import { DossierValidationService } from "./dossier-validation.service";
import { BusinessPlanService } from "./business-plan.service";
import { RapportAnnuelService } from "./rapport-annuel.service";
import { FiscalSimulationService } from "./fiscal-simulation.service";
import { renderDossierCreditPlateformePdf } from "./dossier-credit-plateforme-pdf-renderer";
import { renderRapportAnnuelPdf } from "./rapport-annuel-pdf-renderer";
import { renderRapportAnnuelDocx } from "./rapport-annuel-docx-renderer";
import { renderRapportAnnuelPptx } from "./rapport-annuel-pptx-renderer";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";
import { UpdateBusinessPlanDto, CreateLoanScenarioDto, UpdateLoanScenarioDto } from "./dto/business-plan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { FiscalRuleScope, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Écran Finance (FINANCE) — voir audit du 18 oct. 2026.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.FINANCE);
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
    private readonly businessPlan: BusinessPlanService,
    private readonly rapportAnnuel: RapportAnnuelService,
    private readonly accountingService: AccountingService,
    private readonly fiscalSimulation: FiscalSimulationService,
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

  // Simulation fiscale d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct.
  // 2026, point 2) — jusqu'ici réservée à une boutique précise
  // (FinanceController.simulationFiscale) ; même avertissement : jamais une
  // déclaration officielle, toujours un ordre de grandeur à partir des
  // règles fiscales PLATFORM réellement configurées.
  @Get("simulation-fiscale")
  simulationFiscale(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    requireAdmin(user);
    const { fromDate, toDate } = this.periode(from, to);
    return this.fiscalSimulation.simulerPlateforme(fromDate, toDate);
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

  /**
   * Rattrapage ponctuel, réservé à l'administration ELEGANZ : comptabilise
   * a posteriori les ventes d'une boutique antérieures à la mise en service
   * du moteur comptable (voir AccountingService.backfillMissingSalesRevenue
   * et docs/ARCHITECTURE_FINANCE.md §8bis). Action manuelle, exécutée au cas
   * par cas avec l'accord explicite du propriétaire de la boutique concernée
   * — jamais appelée automatiquement. Idempotent : relancer sur une boutique
   * déjà rattrapée ne recrée rien (voir la contrainte d'unicité
   * JournalEntry).
   */
  @Post("backfill-shop-sales-revenue")
  async backfillShopSalesRevenue(@CurrentUser() user: AuthenticatedUser, @Body("shopId") shopId: string) {
    requireAdmin(user);
    if (!shopId) {
      throw new BadRequestException("shopId requis.");
    }
    return this.accountingService.backfillMissingSalesRevenue(shopId);
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

  // Dossier de crédit d'ELEGANZ elle-même (demande du 16 oct. 2026, point 2)
  // — pendant plateforme du dossier crédit boutique. Jamais persisté,
  // toujours recalculé depuis les écritures réelles (scope PLATFORM).
  @Get("dossier-credit")
  dossierCredit(@CurrentUser() user: AuthenticatedUser, @Query("mois") mois?: string) {
    requireAdmin(user);
    return this.adminFinanceService.dossierCredit(mois ? Number(mois) : undefined);
  }

  @Get("export/dossier-credit")
  async exportDossierCredit(@CurrentUser() user: AuthenticatedUser, @Res() res: Response, @Query("mois") mois?: string) {
    requireAdmin(user);
    const dossier = await this.adminFinanceService.dossierCredit(mois ? Number(mois) : undefined);
    const doc = renderDossierCreditPlateformePdf(dossier);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="dossier-credit-eleganz.pdf"`);
    return doc.pipe(res);
  }

  // Business plan et scénarios de prêt d'ELEGANZ elle-même (16 oct. 2026,
  // point 2) — mêmes routes que côté boutique (finance.controller.ts),
  // scope PLATFORM/shopId null.
  @Get("business-plan")
  businessPlanObtenir(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.businessPlan.obtenir(FiscalRuleScope.PLATFORM, null);
  }

  @Patch("business-plan")
  businessPlanEnregistrer(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBusinessPlanDto) {
    requireAdmin(user);
    return this.businessPlan.enregistrer(FiscalRuleScope.PLATFORM, null, dto);
  }

  @Post("business-plan/scenarios")
  scenarioAjouter(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanScenarioDto) {
    requireAdmin(user);
    return this.businessPlan.ajouterScenario(FiscalRuleScope.PLATFORM, null, dto);
  }

  @Patch("business-plan/scenarios/:scenarioId")
  scenarioModifier(
    @CurrentUser() user: AuthenticatedUser,
    @Param("scenarioId") scenarioId: string,
    @Body() dto: UpdateLoanScenarioDto,
  ) {
    requireAdmin(user);
    return this.businessPlan.modifierScenario(FiscalRuleScope.PLATFORM, null, scenarioId, dto);
  }

  @Delete("business-plan/scenarios/:scenarioId")
  scenarioSupprimer(@CurrentUser() user: AuthenticatedUser, @Param("scenarioId") scenarioId: string) {
    requireAdmin(user);
    return this.businessPlan.supprimerScenario(FiscalRuleScope.PLATFORM, null, scenarioId);
  }

  // Rapport annuel d'ELEGANZ elle-même (16 oct. 2026, point 3) — mêmes
  // routes et mêmes formats d'export que côté boutique.
  @Get("rapport-annuel")
  rapportAnnuelDonnees(@CurrentUser() user: AuthenticatedUser, @Query("annee") annee?: string) {
    requireAdmin(user);
    return this.rapportAnnuel.assembler(FiscalRuleScope.PLATFORM, null, annee ? Number(annee) : new Date().getFullYear());
  }

  @Get("export/rapport-annuel")
  async exportRapportAnnuel(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query("annee") annee?: string,
    @Query("format") format?: string,
  ) {
    requireAdmin(user);
    const donnees = await this.rapportAnnuel.assembler(
      FiscalRuleScope.PLATFORM,
      null,
      annee ? Number(annee) : new Date().getFullYear(),
    );
    if (format === "docx") {
      const buffer = await renderRapportAnnuelDocx(donnees);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-annuel-eleganz-${donnees.annee}.docx"`);
      return res.send(buffer);
    }
    if (format === "pptx") {
      const buffer = await renderRapportAnnuelPptx(donnees);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-annuel-eleganz-${donnees.annee}.pptx"`);
      return res.send(buffer);
    }
    const doc = renderRapportAnnuelPdf(donnees);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="rapport-annuel-eleganz-${donnees.annee}.pdf"`);
    return doc.pipe(res);
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
