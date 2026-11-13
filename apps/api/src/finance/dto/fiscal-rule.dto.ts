import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { FiscalRuleCategory, FiscalRuleTrancheMode } from "@eleganz/database";

const CATEGORIES = Object.values(FiscalRuleCategory);
const TRANCHE_MODES = Object.values(FiscalRuleTrancheMode);

// Une tranche du barème (voir FiscalRuleTrancheMode dans schema.prisma) —
// `max` vide = tranche illimitée vers le haut (ex. "40 % au-delà de
// 43.200.000 FC").
export class TrancheFiscaleDto {
  @IsNumber()
  @Min(0)
  min!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max?: number;

  @IsNumber()
  @Min(0)
  taux!: number;
}

export class CreateFiscalRuleDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsIn(CATEGORIES)
  category!: FiscalRuleCategory;

  @IsString()
  rateOrFormula!: string;

  @IsOptional()
  @IsString()
  baseCalcul?: string;

  @IsOptional()
  @IsString()
  champApplication?: string;

  @IsOptional()
  @IsString()
  regime?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  sourceReference?: string;

  @IsOptional()
  @IsIn(TRANCHE_MODES)
  trancheMode?: FiscalRuleTrancheMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrancheFiscaleDto)
  tranches?: TrancheFiscaleDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  trancheReferenceValeur?: number;

  @IsOptional()
  @IsString()
  trancheReferenceLabel?: string;

  @IsString()
  motif!: string; // justification de la création — exigée dès la première version (§5.7)
}

export class UpdateFiscalRuleDto {
  @IsOptional() @IsString() @MinLength(2) label?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: FiscalRuleCategory;
  @IsOptional() @IsString() rateOrFormula?: string;
  @IsOptional() @IsString() baseCalcul?: string;
  @IsOptional() @IsString() champApplication?: string;
  @IsOptional() @IsString() regime?: string;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() sourceReference?: string;

  @IsOptional() @IsIn(TRANCHE_MODES) trancheMode?: FiscalRuleTrancheMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrancheFiscaleDto)
  tranches?: TrancheFiscaleDto[];

  @IsOptional() @IsNumber() @Min(0) trancheReferenceValeur?: number;
  @IsOptional() @IsString() trancheReferenceLabel?: string;

  @IsString()
  motif!: string; // jamais de modification sans motif tracé (§5.7)
}
