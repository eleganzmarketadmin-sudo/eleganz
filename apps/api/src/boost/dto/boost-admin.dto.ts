import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, Matches } from "class-validator";
import { BoostCanal } from "@eleganz/database";

// Configuration d'un canal publicitaire externe — RÉVISÉ le 27 nov. 2026
// (ELEGANZ BOOST 360°, intégration réelle) : porte la configuration de
// l'app OAuth D'ELEGANZ pour ce réseau (jamais le compte d'une boutique en
// particulier, voir le commentaire détaillé sur BoostCanalConfig dans
// schema.prisma). `apiKey`/`apiSecret` = Client ID/Secret de l'app ELEGANZ ;
// pour GOOGLE spécifiquement, `accountId` porte le jeton développeur Google
// Ads (faute d'un champ dédié, voir google-ads.adapter.ts).
export class UpsertBoostCanalConfigDto {
  @IsOptional()
  connecte?: boolean;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  redirectUriOverride?: string;

  @IsOptional()
  @IsString()
  scopesConfigures?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class CreateBoostCoutExterneDto {
  @IsEnum(BoostCanal)
  canal!: BoostCanal;

  // "YYYY-MM"
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: "La période doit être au format AAAA-MM." })
  periode!: string;

  @IsNumber()
  @Min(0)
  montantUSD!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
