import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, Matches } from "class-validator";
import { BoostCanal } from "@eleganz/database";

// Configuration d'un canal publicitaire externe (27 nov. 2026, réponse Q1 du
// cadrage : champs structurés "déjà prévus", prêts à être connectés plus
// tard — aucun champ ici ne déclenche un appel réel vers la régie.
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
