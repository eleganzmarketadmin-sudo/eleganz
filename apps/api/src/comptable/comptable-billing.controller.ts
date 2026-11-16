import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { ComptableBillingService } from "./comptable-billing.service";
import { ComptableService } from "./comptable.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";
import { BulkRemindDto } from "../billing/dto/bulk-remind.dto";
import { CreerUploadPreuvePaiementDto, SoumettrePreuvePaiementDto } from "../billing/dto/payment-proof.dto";
import { ReactivationDecisionDto } from "../billing/dto/reactivation-decision.dto";

// Granularité par route (audit du 18 oct. 2026) : l'aperçu est propre à
// l'écran Comptable (COMPTABLE), les factures sont gérées depuis l'écran
// Factures (FACTURES), et les déclenchements de cycle sont proposés aussi
// bien depuis Tarifs que depuis Comptable — d'où le double menu accepté
// pour runTrialCheck/runRenewalBilling/runSuspensionCheck.
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin | MenuAdmin[]) {
  requireAdminMenu(user, menu);
}

/**
 * Facturation Secourable (prompt du 13 oct. 2026, §14 et §19) — même
 * découpage que DriverBillingController : déclenchement manuel des
 * transitions de cycle, plus la vue agrégée pour le Centre de pilotage.
 */
@Controller()
export class ComptableBillingController {
  constructor(
    private readonly comptableBillingService: ComptableBillingService,
    private readonly comptableService: ComptableService,
  ) {}

  @Get("comptable/subscription/invoices")
  @UseGuards(JwtAuthGuard)
  async myInvoices(@CurrentUser() user: AuthenticatedUser) {
    const subscription = await this.comptableService.getOrCreateSubscription(user.id);
    return this.comptableBillingService.listInvoices(subscription.id);
  }

  @Get("admin/comptable/overview")
  @UseGuards(JwtAuthGuard)
  overview(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.COMPTABLE);
    return this.comptableBillingService.adminOverview();
  }

  @Get("admin/comptable/invoices")
  @UseGuards(JwtAuthGuard)
  listAllInvoices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.listAllInvoices();
  }

  @Post("admin/comptable/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, [MenuAdmin.TARIFS, MenuAdmin.COMPTABLE]);
    return this.comptableBillingService.processTrialExpirations();
  }

  @Post("admin/comptable/run-renewal-billing")
  @UseGuards(JwtAuthGuard)
  runRenewalBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, [MenuAdmin.TARIFS, MenuAdmin.COMPTABLE]);
    return this.comptableBillingService.runRenewalBilling();
  }

  // Renommé en interne le 16 nov. 2026 (chantier relances/recouvrement) :
  // appelle désormais executerEscaladeFacturesComptable(), qui fait à la
  // fois les relances numérotées ET la suspension.
  @Post("admin/comptable/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, [MenuAdmin.TARIFS, MenuAdmin.COMPTABLE]);
    return this.comptableBillingService.executerEscaladeFacturesComptable();
  }

  @Post("admin/comptable/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.markInvoicePaidAndReactivate(invoiceId, user.id);
  }

  // --- Relances numérotées, preuves de paiement, réactivation (16 nov.
  // 2026, chantier relances/recouvrement) — même motif que BillingController.

  @Post("admin/comptable/invoices/bulk-remind")
  @UseGuards(JwtAuthGuard)
  bulkRemind(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkRemindDto) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.envoyerRelancesManuelles(dto.invoiceIds, user.id);
  }

  @Get("admin/comptable/invoices/:invoiceId/reminders")
  @UseGuards(JwtAuthGuard)
  listReminders(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.listReminders(invoiceId);
  }

  @Get("admin/comptable/invoices/:invoiceId/proofs")
  @UseGuards(JwtAuthGuard)
  listProofs(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.listPaymentProofs(invoiceId);
  }

  @Get("admin/comptable/reactivation-requests")
  @UseGuards(JwtAuthGuard)
  listReactivationRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED",
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.listReactivationRequests(status);
  }

  @Post("admin/comptable/reactivation-requests/:requestId/decision")
  @UseGuards(JwtAuthGuard)
  decideReactivation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") requestId: string,
    @Body() dto: ReactivationDecisionDto,
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.comptableBillingService.validerReactivation(requestId, dto.decision, user.id, dto.note);
  }

  // Dépôt de preuve de paiement par l'abonné lui-même, résolu depuis son
  // propre abonnement (pas de :subscriptionId dans l'URL) — aucune garde
  // bloquante n'existe aujourd'hui côté Secourable pour un abonnement
  // SUSPENDED, donc rien à corriger ici contrairement au côté boutique.
  @Post("comptable/subscription/invoices/:invoiceId/proof-of-payment/upload-url")
  @UseGuards(JwtAuthGuard)
  async creerUploadPreuvePaiement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: CreerUploadPreuvePaiementDto,
  ) {
    const subscription = await this.comptableService.getOrCreateSubscription(user.id);
    return this.comptableBillingService.creerUrlUploadPreuvePaiement(subscription.id, invoiceId, dto.contentType);
  }

  @Post("comptable/subscription/invoices/:invoiceId/proof-of-payment")
  @UseGuards(JwtAuthGuard)
  async soumettrePreuvePaiement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: SoumettrePreuvePaiementDto,
  ) {
    const subscription = await this.comptableService.getOrCreateSubscription(user.id);
    return this.comptableBillingService.soumettrePreuvePaiement(subscription.id, invoiceId, user.id, dto.fileUrl, dto.note);
  }
}
