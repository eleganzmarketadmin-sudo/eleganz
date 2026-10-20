import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

/**
 * Ajustement manuel de stock (20 oct. 2026) — la seule façon acceptée de
 * corriger un écart constaté (inventaire physique, casse, erreur de saisie)
 * en dehors des ventes/retours/réceptions déjà automatiques. `newQty` est
 * la quantité réelle constatée, jamais un delta — le service calcule
 * lui-même l'écart et l'enregistre comme un StockMovement ADJUSTMENT
 * traçable, pour ne jamais perdre l'historique comme le ferait un simple
 * champ écrasé.
 */
export class AdjustStockDto {
  @IsInt()
  @Min(0)
  newQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
