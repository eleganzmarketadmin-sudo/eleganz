import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ComptableService } from "./comptable.service";
import { ComptableExportService } from "./comptable-export.service";
import { renderSynthesePdf, renderDossierFinancementPdf } from "./comptable-pdf-renderer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { ComptableDebtType } from "@eleganz/database";
import {
  AddDebtPaymentDto,
  AddRentExpenseDto,
  CreateActivityDto,
  CreateDebtDto,
  CreateEntryDto,
  CreateRentalUnitDto,
  CreateWorkerRemittanceDto,
  QuickEntryDto,
  RecordRentPaymentDto,
  ChoosePlanDto,
} from "./dto/comptable.dto";

/**
 * ELEGANZ Mon Comptable (prompt du 13 oct. 2026) — toutes les routes
 * n'exigent qu'un compte ELEGANZ authentifié, quel que soit son rôle
 * (BUYER, SHOP_OWNER...) : le module est utilisable sans boutique ni
 * catalogue (prompt §1), le compte ELEGANZ commun suffit (prompt §3).
 */
@Controller("comptable")
@UseGuards(JwtAuthGuard)
export class ComptableController {
  constructor(
    private readonly comptableService: ComptableService,
    private readonly comptableExportService: ComptableExportService,
  ) {}

  @Post("activities")
  createActivity(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityDto) {
    return this.comptableService.createActivity(user.id, dto);
  }

  @Get("activities")
  listActivities(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.listActivities(user.id);
  }

  @Post("activities/:activityId/archive")
  archiveActivity(@CurrentUser() user: AuthenticatedUser, @Param("activityId") activityId: string) {
    return this.comptableService.archiveActivity(user.id, activityId);
  }

  @Post("entries/quick")
  quickEntry(@CurrentUser() user: AuthenticatedUser, @Body() dto: QuickEntryDto) {
    return this.comptableService.quickEntry(user.id, dto);
  }

  @Post("entries")
  createEntry(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEntryDto) {
    return this.comptableService.createEntry(user.id, dto);
  }

  @Get("entries")
  listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query("activityId") activityId?: string,
    @Query("depuis") depuis?: string,
    @Query("jusqu_a") jusqu_a?: string,
  ) {
    return this.comptableService.listEntries(user.id, activityId, depuis, jusqu_a);
  }

  @Patch("entries/:entryId")
  updateEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entryId") entryId: string,
    @Body() dto: Partial<CreateEntryDto>,
  ) {
    return this.comptableService.updateEntry(user.id, entryId, dto);
  }

  @Delete("entries/:entryId")
  deleteEntry(@CurrentUser() user: AuthenticatedUser, @Param("entryId") entryId: string) {
    return this.comptableService.deleteEntry(user.id, entryId);
  }

  @Post("debts")
  createDebt(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDebtDto) {
    return this.comptableService.createDebt(user.id, dto);
  }

  @Get("debts")
  listDebts(
    @CurrentUser() user: AuthenticatedUser,
    @Query("activityId") activityId?: string,
    @Query("type") type?: ComptableDebtType,
  ) {
    return this.comptableService.listDebts(user.id, activityId, type);
  }

  @Post("debts/:debtId/payments")
  addDebtPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("debtId") debtId: string,
    @Body() dto: AddDebtPaymentDto,
  ) {
    return this.comptableService.addDebtPayment(user.id, debtId, dto);
  }

  @Post("debts/:debtId/settled")
  markDebtSettled(
    @CurrentUser() user: AuthenticatedUser,
    @Param("debtId") debtId: string,
    @Body("settled") settled: boolean,
  ) {
    return this.comptableService.markDebtSettled(user.id, debtId, settled);
  }

  @Post("rental-units")
  createRentalUnit(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRentalUnitDto) {
    return this.comptableService.createRentalUnit(user.id, dto);
  }

  @Get("rental-units")
  listRentalUnits(@CurrentUser() user: AuthenticatedUser, @Query("activityId") activityId?: string) {
    return this.comptableService.listRentalUnits(user.id, activityId);
  }

  @Post("rental-units/:unitId/payments")
  recordRentPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("unitId") unitId: string,
    @Body() dto: RecordRentPaymentDto,
  ) {
    return this.comptableService.recordRentPayment(user.id, unitId, dto);
  }

  @Post("rental-units/:unitId/expenses")
  addRentExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param("unitId") unitId: string,
    @Body() dto: AddRentExpenseDto,
  ) {
    return this.comptableService.addRentExpense(user.id, unitId, dto);
  }

  @Post("worker-remittances")
  createWorkerRemittance(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkerRemittanceDto) {
    return this.comptableService.createWorkerRemittance(user.id, dto);
  }

  @Get("worker-remittances")
  listWorkerRemittances(@CurrentUser() user: AuthenticatedUser, @Query("activityId") activityId?: string) {
    return this.comptableService.listWorkerRemittances(user.id, activityId);
  }

  @Post("worker-remittances/:remittanceId/settled")
  markRemittanceSettled(@CurrentUser() user: AuthenticatedUser, @Param("remittanceId") remittanceId: string) {
    return this.comptableService.markRemittanceSettled(user.id, remittanceId);
  }

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.dashboard(user.id);
  }

  @Get("dashboard/historique")
  dashboardHistorique(@CurrentUser() user: AuthenticatedUser, @Query("jours") jours?: string) {
    return this.comptableService.dashboardHistorique(user.id, jours ? Number(jours) : undefined);
  }

  @Get("dashboard/comparaison")
  dashboardComparaison(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.dashboardComparaison(user.id);
  }

  @Get("reminders")
  reminders(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.reminders(user.id);
  }

  @Get("agenda")
  agenda(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.agenda(user.id);
  }

  @Get("subscription")
  subscription(@CurrentUser() user: AuthenticatedUser) {
    return this.comptableService.getOrCreateSubscription(user.id);
  }

  @Post("subscription/plan")
  choosePlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChoosePlanDto) {
    return this.comptableService.choosePlan(user.id, dto.plan);
  }

  /**
   * Synthèse périodique exportable (prompt §10.5) — JSON par défaut, ou
   * PDF/Excel via ?format=. Jamais présentée comme un état financier
   * certifié (voir le disclaimer dans le renderer PDF).
   */
  @Get("export/synthese")
  async exportSynthese(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") fromStr: string,
    @Query("to") toStr: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    if (!fromStr || !toStr) throw new BadRequestException("Les paramètres from et to sont requis (AAAA-MM-JJ).");
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("Dates invalides.");
    }
    const synthese = await this.comptableExportService.synthesePeriode(user.id, from, to);

    if (format === "xlsx") {
      const buffer = this.comptableExportService.exporterSyntheseExcel(synthese);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="synthese-mon-comptable.xlsx"');
      return res.send(buffer);
    }
    if (format === "pdf") {
      const doc = renderSynthesePdf(synthese);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="synthese-mon-comptable.pdf"');
      return doc.pipe(res);
    }
    return res.json(synthese);
  }

  /**
   * Dossier préparatoire pour demande de financement (prompt §15) — PDF
   * uniquement, avec bandeau d'avertissement intégré au document.
   */
  @Get("export/dossier-financement")
  async exportDossierFinancement(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const dossier = await this.comptableExportService.dossierFinancement(user.id);
    const doc = renderDossierFinancementPdf(dossier);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="dossier-financement-eleganz.pdf"');
    return doc.pipe(res);
  }
}
