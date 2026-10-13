import { IsDateString, IsInt, IsNumber, IsString, Min, MinLength } from "class-validator";

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsDateString()
  acquisitionDate!: string;

  @IsNumber()
  @Min(0)
  acquisitionCost!: number;

  // Durée d'amortissement en mois — saisie libre, pas de table de durées
  // réglementaires par catégorie à cette phase (voir
  // docs/ARCHITECTURE_FINANCE.md §8quater).
  @IsInt()
  @Min(1)
  durationMonths!: number;
}
