import { Controller, ForbiddenException, Post, UseGuards } from "@nestjs/common";
import { EcheancierService } from "./echeancier.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
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
