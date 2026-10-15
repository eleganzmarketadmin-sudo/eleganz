import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ComptableBillingService } from "./comptable-billing.service";
import { ComptableService } from "./comptable.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
    requireAdmin(user);
    return this.comptableBillingService.adminOverview();
  }

  @Get("admin/comptable/invoices")
  @UseGuards(JwtAuthGuard)
  listAllInvoices(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.comptableBillingService.listAllInvoices();
  }

  @Post("admin/comptable/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.comptableBillingService.processTrialExpirations();
  }

  @Post("admin/comptable/run-renewal-billing")
  @UseGuards(JwtAuthGuard)
  runRenewalBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.comptableBillingService.runRenewalBilling();
  }

  @Post("admin/comptable/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser, @Body("graceDays") graceDays?: number) {
    requireAdmin(user);
    return this.comptableBillingService.suspendOverdueSubscriptions(graceDays);
  }

  @Post("admin/comptable/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user);
    return this.comptableBillingService.markInvoicePaidAndReactivate(invoiceId);
  }
}
