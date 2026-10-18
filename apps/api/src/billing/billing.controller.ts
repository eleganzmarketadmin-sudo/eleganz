import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, MenuAdmin } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Granularité par route (audit du 18 oct. 2026) : la liste et le paiement
// des factures sont gérés depuis l'écran Factures (FACTURES), les
// déclenchements de cycle depuis l'écran Tarifs (TARIFS).
function requireAdmin(user: AuthenticatedUser, menu: MenuAdmin) {
  requireAdminMenu(user, menu);
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

  @Post("admin/billing/run-suspension-check")
  @UseGuards(JwtAuthGuard)
  runSuspensionCheck(@CurrentUser() user: AuthenticatedUser, @Body("graceDays") graceDays?: number) {
    requireAdmin(user, MenuAdmin.TARIFS);
    return this.billingService.suspendOverdueShops(graceDays);
  }

  @Post("admin/billing/invoices/:invoiceId/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    requireAdmin(user, MenuAdmin.FACTURES);
    return this.billingService.markInvoicePaidAndReactivate(invoiceId);
  }
}
