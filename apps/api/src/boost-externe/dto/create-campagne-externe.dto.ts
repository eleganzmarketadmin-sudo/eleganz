import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { BoostCanal, BoostCible } from "@eleganz/database";

// Assistant "ELEGANZ BOOST 360°" (27 nov. 2026) — une soumission crée un
// groupe de campagnes, une par canal choisi (voir BoostExterneService).
// SOCIAL_360 n'est pas une cible valide ici (c'est la famille équivalente
// du Boost interne) — seuls BOUTIQUE/PRODUIT/COLLECTION ont un sens pour
// une campagne publicitaire externe réelle.
export class CreateCampagneExterneDto {
  @IsEnum(BoostCible)
  cible!: BoostCible.BOUTIQUE | BoostCible.PRODUIT | BoostCible.COLLECTION;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  productIds?: string[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @IsEnum(BoostCanal, { each: true })
  canaux!: BoostCanal[];

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsNumber()
  @Min(1)
  budgetTotalUSD!: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  audienceGeo?: string; // code pays ISO 3166-1 alpha-2 — défaut PlatformSettings.boostExterneAudienceGeoParDefaut si absent
}
