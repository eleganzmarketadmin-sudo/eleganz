import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("shops/:shopId/invoices")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  listInvoices(@Param("shopId") shopId: string) {
    return this.billingService.listInvoices(shopId);
  }

  // Déclenchement manuel tant qu'aucun planificateur n'est en place (voir
  // NEXT_ACTIONS.md) — un admin lance ces deux vérifications périodiquement.
  @Post("admin/billing/run-trial-check")
  @UseGuards(JwtAuthGuard)
  runTrialCheck(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.billingService.processTrialExpirations();
  }

  @Post("admin/billing/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser, @Body("graceDays") graceDays?: number) {
    requireAdmin(user);
    return this.billingService.suspendOverdueShops(graceDays);
  }

  @Post("admin/billing/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user);
    return this.billingService.markInvoicePaidAndReactivate(invoiceId);
  }
}
