import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";
import { BoostCible } from "@eleganz/database";

export class CreateBoostTarifDto {
  @IsEnum(BoostCible)
  cible!: BoostCible;

  // Nom du palier affiché à la boutique (ex. "Flash", "Gold") — 27 nov.
  // 2026, refonte ELEGANZ BOOST : remplace le forfait plat par durée unique.
  @IsString()
  @MinLength(1)
  nom!: string;

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsInt()
  @Min(1)
  dureeJours!: number;

  @IsNumber()
  @Min(0)
  prixUSD!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixCDF?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxProduits?: number;

  // Matrice de fonctionnalités libre (clé → booléen ou nombre), 100 %
  // modifiable depuis le Centre de pilotage — jamais une liste figée.
  @IsOptional()
  @IsObject()
  featuresJson?: Record<string, unknown>;
}

export class UpdateBoostTarifDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nom?: string;

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dureeJours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUSD?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixCDF?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxProduits?: number;

  @IsOptional()
  @IsObject()
  featuresJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
