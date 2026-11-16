import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { DriverBillingService } from "./driver-billing.service";
import { DeliveryService } from "./delivery.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";
import { BulkRemindDto } from "../billing/dto/bulk-remind.dto";
import { CreerUploadPreuvePaiementDto, SoumettrePreuvePaiementDto } from "../billing/dto/payment-proof.dto";
import { ReactivationDecisionDto } from "../billing/dto/reactivation-decision.dto";

// Granularité par route (audit du 18 oct. 2026) : la liste et le paiement
// des factures sont gérés depuis l'écran Factures (FACTURES), les
// déclenchements de cycle depuis l'écran Tarifs (TARIFS).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin) {
  requireAdminMenu(user, menu);
}

/**
 * Facturation de l'espace livreur (prompt du 13 oct. 2026, point 1) — même
 * découpage que BillingController côté boutiques : déclenchement manuel
 * des transitions de cycle tant qu'aucun planificateur n'est en place.
 */
@Controller()
export class DriverBillingController {
  constructor(
    private readonly driverBillingService: DriverBillingService,
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get("delivery/me/invoices")
  @UseGuards(JwtAuthGuard)
  async myInvoices(@CurrentUser() user: AuthenticatedUser) {
    const driver = await this.deliveryService.myProfile(user.id);
    if (!driver) return [];
    return this.driverBillingService.listInvoices(driver.id);
  }

  @Get("admin/driver-billing/invoices")
  @UseGuards(JwtAuthGuard)
  listAllInvoices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.listAllInvoices();
  }

  @Post("admin/driver-billing/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.driverBillingService.processTrialExpirations();
  }

  @Post("admin/driver-billing/run-monthly-billing")
  @UseGuards(JwtAuthGuard)
  runMonthlyBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.driverBillingService.runMonthlyBilling();
  }

  // Renommé en interne le 16 nov. 2026 (chantier relances/recouvrement) :
  // appelle désormais executerEscaladeFacturesLivreurs(), qui fait à la
  // fois les relances numérotées ET la suspension — les seuils se règlent
  // depuis l'écran Tarifs (PlatformSettings), communs aux trois domaines.
  @Post("admin/driver-billing/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.driverBillingService.executerEscaladeFacturesLivreurs();
  }

  @Post("admin/driver-billing/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.markInvoicePaidAndReactivate(invoiceId, user.id);
  }

  // --- Relances numérotées, preuves de paiement, réactivation (16 nov.
  // 2026, chantier relances/recouvrement) — même motif que BillingController.

  @Post("admin/driver-billing/invoices/bulk-remind")
  @UseGuards(JwtAuthGuard)
  bulkRemind(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkRemindDto) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.envoyerRelancesManuelles(dto.invoiceIds, user.id);
  }

  @Get("admin/driver-billing/invoices/:invoiceId/reminders")
  @UseGuards(JwtAuthGuard)
  listReminders(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.listReminders(invoiceId);
  }

  @Get("admin/driver-billing/invoices/:invoiceId/proofs")
  @UseGuards(JwtAuthGuard)
  listProofs(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.listPaymentProofs(invoiceId);
  }

  @Get("admin/driver-billing/reactivation-requests")
  @UseGuards(JwtAuthGuard)
  listReactivationRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED",
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.listReactivationRequests(status);
  }

  @Post("admin/driver-billing/reactivation-requests/:requestId/decision")
  @UseGuards(JwtAuthGuard)
  decideReactivation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") requestId: string,
    @Body() dto: ReactivationDecisionDto,
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.driverBillingService.validerReactivation(requestId, dto.decision, user.id, dto.note);
  }

  // Dépôt de preuve de paiement par le livreur lui-même, résolu depuis son
  // propre profil (pas de :driverId dans l'URL — même principe que
  // GET /delivery/me/invoices juste au-dessus) : aucune garde de type
  // ShopMembershipGuard ne bloque aujourd'hui un livreur SUSPENDED côté
  // API, donc rien à corriger ici contrairement au côté boutique.
  @Post("delivery/me/invoices/:invoiceId/proof-of-payment/upload-url")
  @UseGuards(JwtAuthGuard)
  async creerUploadPreuvePaiement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: CreerUploadPreuvePaiementDto,
  ) {
    const driver = await this.deliveryService.myProfile(user.id);
    if (!driver) throw new BadRequestException("Aucun profil livreur pour ce compte.");
    return this.driverBillingService.creerUrlUploadPreuvePaiement(driver.id, invoiceId, dto.contentType);
  }

  @Post("delivery/me/invoices/:invoiceId/proof-of-payment")
  @UseGuards(JwtAuthGuard)
  async soumettrePreuvePaiement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: SoumettrePreuvePaiementDto,
  ) {
    const driver = await this.deliveryService.myProfile(user.id);
    if (!driver) throw new BadRequestException("Aucun profil livreur pour ce compte.");
    return this.driverBillingService.soumettrePreuvePaiement(driver.id, invoiceId, user.id, dto.fileUrl, dto.note);
  }
}
