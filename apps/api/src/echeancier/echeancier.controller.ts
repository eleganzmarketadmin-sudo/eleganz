import { Controller, Post, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { EcheancierService } from "./echeancier.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Déclenché depuis l'écran Factures (FACTURES) — voir audit du 18 oct. 2026.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.FACTURES);
}

@Controller("admin/echeancier")
@UseGuards(JwtAuthGuard)
export class EcheancierController {
  constructor(private readonly echeancier: EcheancierService) {}

  // Déclenchement manuel tant qu'aucun planificateur n'est en place (même
  // limite que BillingService.processTrialExpirations) — un admin lance
  // cette vérification une fois par jour depuis le Centre de pilotage.
  @Post("run")
  run(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.echeancier.run();
  }
}
