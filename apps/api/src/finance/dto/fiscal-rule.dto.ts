import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { FiscalRuleCategory } from "@eleganz/database";

const CATEGORIES = Object.values(FiscalRuleCategory);

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

  @IsString()
  motif!: string; // jamais de modification sans motif tracé (§5.7)
}
