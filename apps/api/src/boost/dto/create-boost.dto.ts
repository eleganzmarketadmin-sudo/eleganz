import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { BoostCanal, BoostCible } from "@eleganz/database";

export class CreateBoostDto {
  @IsEnum(BoostCible)
  cible!: BoostCible;

  // Obligatoire seulement si cible = PRODUIT — validé dans BoostService
  // (pas ici, ValidateIf duplique la même condition pour peu de gain sur un
  // DTO aussi court).
  @IsOptional()
  @IsString()
  productId?: string;

  // Famille COLLECTION (27 nov. 2026, refonte ELEGANZ BOOST) — plusieurs
  // articles choisis pour une même campagne, bornés par `tarif.maxProduits`
  // (validé dans BoostService, pas ici).
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  productIds?: string[];

  // Famille SOCIAL_360 (27 nov. 2026) — canaux choisis PARMI ceux marqués
  // disponibles dans `tarif.featuresJson` (validé dans BoostService).
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(BoostCanal, { each: true })
  canaux?: BoostCanal[];

  @IsString()
  tarifId!: string;
}
