import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DriverBillingService } from "./driver-billing.service";
import { DeliveryService } from "./delivery.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
    requireAdmin(user);
    return this.driverBillingService.listAllInvoices();
  }

  @Post("admin/driver-billing/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.driverBillingService.processTrialExpirations();
  }

  @Post("admin/driver-billing/run-monthly-billing")
  @UseGuards(JwtAuthGuard)
  runMonthlyBilling(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.driverBillingService.runMonthlyBilling();
  }

  @Post("admin/driver-billing/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser, @Body("graceDays") graceDays?: number) {
    requireAdmin(user);
    return this.driverBillingService.suspendOverdueDrivers(graceDays);
  }

  @Post("admin/driver-billing/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user);
    return this.driverBillingService.markInvoicePaidAndReactivate(invoiceId);
  }
}
