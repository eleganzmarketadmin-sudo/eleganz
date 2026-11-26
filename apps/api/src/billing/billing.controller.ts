import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { LoansService } from "../finance/loans.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, MenuAdmin } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";
import { BulkRemindDto } from "./dto/bulk-remind.dto";
import { CreerUploadPreuvePaiementDto, SoumettrePreuvePaiementDto } from "./dto/payment-proof.dto";
import { ReactivationDecisionDto } from "./dto/reactivation-decision.dto";
import { BoostService } from "../boost/boost.service";

// Granularité par route (audit du 18 oct. 2026) : la liste et le paiement
// des factures sont gérés depuis l'écran Factures (FACTURES), les
// déclenchements de cycle depuis l'écran Tarifs (TARIFS).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin) {
  requireAdminMenu(user, menu);
}

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly loansService: LoansService,
    private readonly boostService: BoostService,
  ) {}

  @Get("shops/:shopId/invoices")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  listInvoices(@Param("shopId") shopId: string) {
    return this.billingService.listInvoices(shopId);
  }

  // Vue transversale pour l'admin : toutes les factures, toutes boutiques
  // confondues — nécessaire pour le suivi financier depuis le centre de
  // pilotage sans ouvrir chaque boutique une par une.
  @Get("admin/billing/invoices")
  @UseGuards(JwtAuthGuard)
  listAllInvoices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.listAllInvoices();
  }

  // Déclenchement manuel tant qu'aucun planificateur n'est en place (voir
  // NEXT_ACTIONS.md) — un admin lance ces deux vérifications périodiquement.
  @Post("admin/billing/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.billingService.processTrialExpirations();
  }

  @Post("admin/billing/run-monthly-billing")
  @UseGuards(JwtAuthGuard)
  runMonthlyBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.billingService.runMonthlyBilling();
  }

  @Post("admin/billing/run-commission-billing")
  @UseGuards(JwtAuthGuard)
  runCommissionBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.billingService.runCommissionBilling();
  }

  // Renommé en interne le 16 nov. 2026 (chantier relances/recouvrement) :
  // cette route déclenchait auparavant suspendOverdueShops(graceDays) ; elle
  // appelle désormais executerEscaladeFacturesBoutiques(), qui fait à la
  // fois les relances numérotées ET la suspension — les seuils (jours,
  // taux de pénalité) se règlent désormais depuis l'écran Tarifs
  // (PlatformSettings) plutôt que par un paramètre de requête.
  @Post("admin/billing/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.billingService.executerEscaladeFacturesBoutiques();
  }

  @Post("admin/billing/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  async markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    const resultat = await this.billingService.markInvoicePaidAndReactivate(invoiceId, user.id);
    // Boost payant (26 nov. 2026) — hook additif, ne modifie pas
    // BillingService (aucun risque de régression sur les autres `kind` de
    // facture) : une facture kind="boost" active le Boost lié une fois son
    // paiement confirmé par un admin. Ne fait rien pour les autres natures
    // de facture (opening_fee/subscription/commission/...).
    if (resultat.kind === "boost") {
      await this.boostService.activerDepuisFacture(invoiceId);
    }
    return resultat;
  }

  // --- Relances numérotées, preuves de paiement, réactivation (16 nov.
  // 2026, chantier relances/recouvrement).

  @Post("admin/billing/invoices/bulk-remind")
  @UseGuards(JwtAuthGuard)
  bulkRemind(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkRemindDto) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.envoyerRelancesManuelles(dto.invoiceIds, user.id);
  }

  @Get("admin/billing/invoices/:invoiceId/reminders")
  @UseGuards(JwtAuthGuard)
  listReminders(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.listReminders(invoiceId);
  }

  @Get("admin/billing/invoices/:invoiceId/proofs")
  @UseGuards(JwtAuthGuard)
  listProofs(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.listPaymentProofs(invoiceId);
  }

  @Get("admin/billing/reactivation-requests")
  @UseGuards(JwtAuthGuard)
  listReactivationRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED",
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.listReactivationRequests(status);
  }

  @Post("admin/billing/reactivation-requests/:requestId/decision")
  @UseGuards(JwtAuthGuard)
  decideReactivation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") requestId: string,
    @Body() dto: ReactivationDecisionDto,
  ) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.validerReactivation(requestId, dto.decision, user.id, dto.note);
  }

  // --- Factures de commission institution (19 nov. 2026, demande du
  // propriétaire : "les commissions facturées aux institutions doivent
  // figurer dans les factures du module admin et non dans finances") — même
  // garde FACTURES que le reste de cet écran, mais SANS relances/preuves/
  // réactivation : décision explicite du propriétaire, une institution
  // partenaire n'est pas une boutique sous contrat de facturation. Voir
  // LoansService.listInstitutionInvoices/markInstitutionInvoicePaid.

  @Get("admin/billing/institution-invoices")
  @UseGuards(JwtAuthGuard)
  listInstitutionInvoices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.loansService.listInstitutionInvoices();
  }

  @Post("admin/billing/institution-invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markInstitutionInvoicePaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.loansService.markInstitutionInvoicePaid(invoiceId, user.id);
  }

  // Dépôt de preuve de paiement par la boutique elle-même — accessible
  // même boutique SUSPENDED (voir le correctif apporté à
  // ShopMembershipGuard), précisément le cas que cette route sert.
  @Post("shops/:shopId/invoices/:invoiceId/proof-of-payment/upload-url")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  creerUploadPreuvePaiement(
    @Param("shopId") shopId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: CreerUploadPreuvePaiementDto,
  ) {
    return this.billingService.creerUrlUploadPreuvePaiement(shopId, invoiceId, dto.contentType);
  }

  @Post("shops/:shopId/invoices/:invoiceId/proof-of-payment")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  soumettrePreuvePaiement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: SoumettrePreuvePaiementDto,
  ) {
    return this.billingService.soumettrePreuvePaiement(shopId, invoiceId, user.id, dto.fileUrl, dto.note);
  }
}
