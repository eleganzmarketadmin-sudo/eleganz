import { IsNumber, Min } from "class-validator";

/**
 * Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) — combien
 * de CDF pour 1 USD. Validation stricte (> 0) : un taux à zéro ou négatif
 * casserait toute conversion affichée sur la plateforme.
 */
export class UpdateExchangeRateDto {
  @IsNumber()
  @Min(0.0001)
  cdfPerUsd!: number;
}
