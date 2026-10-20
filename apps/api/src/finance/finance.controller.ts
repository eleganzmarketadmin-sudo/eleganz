import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { FinanceService } from "./finance.service";
import { FiscalRulesService } from "./fiscal-rules.service";
import { AccountingQueryService } from "./accounting-query.service";
import { ClosureService } from "./closure.service";
import { FiscalSimulationService } from "./fiscal-simulation.service";
import { DossierValidationService } from "./dossier-validation.service";
import { BusinessPlanService } from "./business-plan.service";
import { RapportAnnuelService } from "./rapport-annuel.service";
import { renderDossierCreditPdf } from "./dossier-credit-pdf-renderer";
import { renderRapportAnnuelPdf } from "./rapport-annuel-pdf-renderer";
import { renderRapportAnnuelDocx } from "./rapport-annuel-docx-renderer";
import { renderRapportAnnuelPptx } from "./rapport-annuel-pptx-renderer";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";
import { UpdateFiscalIdentityDto } from "./dto/update-fiscal-identity.dto";
import { UpdateBusinessPlanDto, CreateLoanScenarioDto, UpdateLoanScenarioDto } from "./dto/business-plan.dto";
import { LoansService } from "./loans.service";
import { CreateLoanDto } from "./dto/loan.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
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
    private readonly dossierValidation: DossierValidationService,
    private readonly businessPlan: BusinessPlanService,
    private readonly rapportAnnuel: RapportAnnuelService,
    private readonly loansService: LoansService,
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
  @RequiresGestionFeature("financeAvancee")
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
  @RequiresGestionFeature("financeAvancee")
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
  @RequiresGestionFeature("financeAvancee")
  balance(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.balance(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  // États financiers réglementaires simplifiés (docs/ARCHITECTURE_FINANCE.md
  // §8ter) — générés automatiquement à partir des mêmes écritures, jamais
  // un substitut à une liasse fiscale établie par un professionnel.
  @Get("compte-resultat")
  @RequiresGestionFeature("financeAvancee")
  compteDeResultat(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.compteDeResultat(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  @Get("bilan")
  @RequiresGestionFeature("financeAvancee")
  bilan(@Param("shopId") shopId: string, @Query("asOf") asOf?: string) {
    return this.accountingQuery.bilan(FiscalRuleScope.SHOP, shopId, asOf ? new Date(asOf) : new Date());
  }

  // États normalisés SYSCOHADA (chantier réactivé, phase 6 — 14 oct. 2026) :
  // regroupement réglementaire par rubrique (actif immobilisé/circulant/
  // trésorerie, capitaux propres/dettes financières/passif circulant ; pour
  // le compte de résultat, exploitation/financier/HAO avec soldes de
  // gestion intermédiaires). Toujours "avant impôt sur les bénéfices" (aucun
  // compte de charge d'impôt n'est encore alimenté) et toujours une
  // estimation de pilotage à faire valider par un expert-comptable externe —
  // jamais une auto-certification.
  @Get("bilan-normalise")
  @RequiresGestionFeature("comptabiliteSyscohada")
  bilanNormalise(@Param("shopId") shopId: string, @Query("asOf") asOf?: string) {
    return this.accountingQuery.bilanNormalise(FiscalRuleScope.SHOP, shopId, asOf ? new Date(asOf) : new Date());
  }

  @Get("compte-resultat-normalise")
  @RequiresGestionFeature("comptabiliteSyscohada")
  compteDeResultatNormalise(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.accountingQuery.compteDeResultatNormalise(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
  }

  // Dossier de validation externe SYSCOHADA (chantier réactivé, phase 7 —
  // 14 oct. 2026) — classeur Excel multi-feuilles (plan comptable, journal,
  // balance, bilan et compte de résultat normalisés + présentation/
  // méthodologie/limites) destiné à un expert-comptable habilité. Période
  // par défaut : depuis le 1er janvier de l'année en cours (un exercice
  // entier, pas seulement le mois en cours comme `periode()` ci-dessus).
  @Get("dossier-validation")
  @RequiresGestionFeature("comptabiliteSyscohada")
  async dossierValidationExterne(
    @Param("shopId") shopId: string,
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), 0, 1);
    const { buffer, nomFichier } = await this.dossierValidation.genererClasseur(FiscalRuleScope.SHOP, shopId, fromDate, toDate);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}"`);
    return res.send(buffer);
  }

  // Assistant de clôture (docs/ARCHITECTURE_FINANCE.md §8quinquies) —
  // verrouille un mois (plus aucune écriture acceptée) et fige un résumé.
  @Get("clotures")
  @RequiresGestionFeature("cloture")
  listClotures(@Param("shopId") shopId: string) {
    return this.closureService.list(FiscalRuleScope.SHOP, shopId);
  }

  @Post("clotures")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("cloture")
  cloturerPeriode(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body("periode") periode: string,
  ) {
    return this.closureService.close(FiscalRuleScope.SHOP, shopId, periode, user.id);
  }

  @Delete("clotures/:periode")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("cloture")
  reouvrirPeriode(
    @Param("shopId") shopId: string,
    @Param("periode") periode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.closureService.reopen(FiscalRuleScope.SHOP, shopId, periode, user.id);
  }

  // Historique des réouvertures (audit de lancement, fix #8) — pour
  // retrouver le résumé d'une clôture supprimée, qui a rouvert et quand.
  @Get("clotures/historique-reouvertures")
  @RequiresGestionFeature("cloture")
  historiqueReouverturesClotures(@Param("shopId") shopId: string) {
    return this.closureService.historiqueReouvertures(FiscalRuleScope.SHOP, shopId);
  }

  // Simulation fiscale (docs/ARCHITECTURE_FINANCE.md §8septies) — jamais
  // une déclaration officielle, toujours un ordre de grandeur.
  @Get("simulation-fiscale")
  @RequiresGestionFeature("financeAvancee")
  simulationFiscale(@Param("shopId") shopId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { fromDate, toDate } = this.periode(from, to);
    return this.fiscalSimulation.simulerShop(shopId, fromDate, toDate);
  }

  // Analytique et prévisions (docs/ARCHITECTURE_FINANCE.md §8octies) —
  // évolution mensuelle réelle, projection calculée côté client (moyenne
  // mobile), toujours étiquetée comme estimation.
  @Get("analytique")
  @RequiresGestionFeature("financeAvancee")
  analytique(@Param("shopId") shopId: string, @Query("mois") mois?: string) {
    const nombreMois = Math.min(Math.max(Number(mois) || 6, 1), 24);
    return this.accountingQuery.evolutionMensuelle(FiscalRuleScope.SHOP, shopId, nombreMois);
  }

  // Relevé de trésorerie réel par devise (docs/ARCHITECTURE_FINANCE.md
  // §8nonies) — soldes et mouvements réels des comptes 5711/5712.
  @Get("tresorerie")
  @RequiresGestionFeature("tresorerie")
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

  // Dossier de crédit (demande du 16 oct. 2026, point 1) — regroupe états
  // financiers, historique et dettes/créances pour appuyer une demande de
  // crédit auprès d'une institution financière. Jamais persisté, toujours
  // recalculé depuis les écritures réelles de la boutique.
  // 20 oct. 2026 (demande : "la liste des fonctionnalités ne sont pas
  // exhaustifs, exemple dossier crédit") — dossier crédit, business plan,
  // prêts et rapport annuel partageaient tous la clé générique
  // "financeAvancee", ce qui empêchait de les répartir entre bouquets
  // différents depuis le Centre de pilotage. Chacun a maintenant sa propre
  // clé de bouquet (voir subscription-plans.service.ts pour la migration
  // qui préserve l'accès existant des boutiques déjà sur "financeAvancee").
  @Get("dossier-credit")
  @RequiresGestionFeature("dossierCredit")
  dossierCredit(@Param("shopId") shopId: string, @Query("mois") mois?: string) {
    return this.financeService.dossierCredit(shopId, mois ? Number(mois) : undefined);
  }

  @Get("export/dossier-credit")
  @RequiresGestionFeature("dossierCredit")
  async exportDossierCredit(
    @Param("shopId") shopId: string,
    @Res() res: Response,
    @Query("mois") mois?: string,
  ) {
    const dossier = await this.financeService.dossierCredit(shopId, mois ? Number(mois) : undefined);
    const doc = renderDossierCreditPdf(dossier);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="dossier-credit-${shopId}.pdf"`);
    return doc.pipe(res);
  }

  // Business plan et scénarios de prêt (16 oct. 2026, point 1) — alimentent
  // le dossier crédit ci-dessus (section business plan) et le futur rapport
  // annuel. OWNER/MANAGER/ACCOUNTANT uniquement : contenu stratégique de la
  // boutique, pas une simple lecture de chiffres déjà publics en interne.
  @Get("business-plan")
  @RequiresGestionFeature("businessPlan")
  businessPlanObtenir(@Param("shopId") shopId: string) {
    return this.businessPlan.obtenir(FiscalRuleScope.SHOP, shopId);
  }

  @Patch("business-plan")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("businessPlan")
  businessPlanEnregistrer(@Param("shopId") shopId: string, @Body() dto: UpdateBusinessPlanDto) {
    return this.businessPlan.enregistrer(FiscalRuleScope.SHOP, shopId, dto);
  }

  @Post("business-plan/scenarios")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("businessPlan")
  scenarioAjouter(@Param("shopId") shopId: string, @Body() dto: CreateLoanScenarioDto) {
    return this.businessPlan.ajouterScenario(FiscalRuleScope.SHOP, shopId, dto);
  }

  @Patch("business-plan/scenarios/:scenarioId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("businessPlan")
  scenarioModifier(
    @Param("shopId") shopId: string,
    @Param("scenarioId") scenarioId: string,
    @Body() dto: UpdateLoanScenarioDto,
  ) {
    return this.businessPlan.modifierScenario(FiscalRuleScope.SHOP, shopId, scenarioId, dto);
  }

  @Delete("business-plan/scenarios/:scenarioId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("businessPlan")
  scenarioSupprimer(@Param("shopId") shopId: string, @Param("scenarioId") scenarioId: string) {
    return this.businessPlan.supprimerScenario(FiscalRuleScope.SHOP, shopId, scenarioId);
  }

  // Prêts réellement obtenus (19 oct. 2026) — distinct des scénarios
  // ci-dessus (purement simulatifs) : un prêt ici est effectivement
  // décaissé et comptabilisé dès sa création (voir LoansService). Même
  // restriction OWNER/MANAGER/ACCOUNTANT que le business plan.
  @Get("loans")
  @RequiresGestionFeature("prets")
  loansLister(@Param("shopId") shopId: string) {
    return this.loansService.listForShop(shopId);
  }

  @Post("loans")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("prets")
  loansObtenir(@Param("shopId") shopId: string, @Body() dto: CreateLoanDto) {
    return this.loansService.create(shopId, dto);
  }

  // `periode` au format AAAA-MM, mois courant par défaut.
  @Post("loans/:loanId/echeances")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("prets")
  loansComptabiliserEcheance(
    @Param("shopId") shopId: string,
    @Param("loanId") loanId: string,
    @Query("periode") periode?: string,
  ) {
    return this.loansService.comptabiliserEcheance(shopId, loanId, periode);
  }

  @Get("loans/:loanId/echeances")
  @RequiresGestionFeature("prets")
  loansListerEcheances(@Param("shopId") shopId: string, @Param("loanId") loanId: string) {
    return this.loansService.listerEcheances(shopId, loanId);
  }

  // Rapport annuel (16 oct. 2026, point 3) — aux normes professionnelles
  // SYSCOHADA/OHADA, exportable en PDF/Word/PowerPoint. Jamais persisté,
  // toujours recalculé depuis les écritures réelles de l'année demandée.
  @Get("rapport-annuel")
  @RequiresGestionFeature("rapportAnnuel")
  rapportAnnuelDonnees(@Param("shopId") shopId: string, @Query("annee") annee?: string) {
    return this.rapportAnnuel.assembler(FiscalRuleScope.SHOP, shopId, annee ? Number(annee) : new Date().getFullYear());
  }

  @Get("export/rapport-annuel")
  @RequiresGestionFeature("rapportAnnuel")
  async exportRapportAnnuel(
    @Param("shopId") shopId: string,
    @Res() res: Response,
    @Query("annee") annee?: string,
    @Query("format") format?: string,
  ) {
    const donnees = await this.rapportAnnuel.assembler(
      FiscalRuleScope.SHOP,
      shopId,
      annee ? Number(annee) : new Date().getFullYear(),
    );
    if (format === "docx") {
      const buffer = await renderRapportAnnuelDocx(donnees);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-annuel-${donnees.annee}.docx"`);
      return res.send(buffer);
    }
    if (format === "pptx") {
      const buffer = await renderRapportAnnuelPptx(donnees);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-annuel-${donnees.annee}.pptx"`);
      return res.send(buffer);
    }
    const doc = renderRapportAnnuelPdf(donnees);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="rapport-annuel-${donnees.annee}.pdf"`);
    return doc.pipe(res);
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
