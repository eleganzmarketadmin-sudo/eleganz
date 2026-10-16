import { IsString, IsNotEmpty } from "class-validator";

/**
 * Changement de bouquet Gestion en libre-service par le propriétaire de la
 * boutique (16 oct. 2026, demande du propriétaire ELEGANZ, point 1 des
 * propositions du 16 oct. 2026 — voir BillingService.changerBouquetGestion).
 * Volontairement limité au bouquet GESTION : le bouquet Marketplace reste
 * un changement réservé à l'administration (/admin/boutiques) à ce stade.
 */
export class ChangeGestionPlanDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;
}
