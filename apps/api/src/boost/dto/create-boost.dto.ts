import { IsEnum, IsOptional, IsString } from "class-validator";
import { BoostCible } from "@eleganz/database";

export class CreateBoostDto {
  @IsEnum(BoostCible)
  cible!: BoostCible;

  // Obligatoire seulement si cible = PRODUIT — validé dans BoostService
  // (pas ici, ValidateIf duplique la même condition pour peu de gain sur un
  // DTO aussi court).
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  tarifId!: string;
}
