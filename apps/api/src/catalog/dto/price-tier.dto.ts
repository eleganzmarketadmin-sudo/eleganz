import { IsInt, IsNumber, Min } from "class-validator";

// Prix de gros par palier de quantité (2 nov. 2026) — voir PriceTier dans
// schema.prisma et pricing.util.ts pour la logique d'application.
export class CreatePriceTierDto {
  // >= 2 : un palier "à partir de 1 pièce" n'aurait aucun sens, ce serait le
  // prix normal — on l'empêche dès la validation plutôt que de laisser
  // passer une saisie qui écraserait silencieusement `sellPrice`.
  @IsInt()
  @Min(2)
  minQuantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
