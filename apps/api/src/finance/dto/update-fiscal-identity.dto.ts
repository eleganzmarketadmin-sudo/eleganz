import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Informations fiscales de l'entreprise (prompt du 13 oct. 2026, §5.1) —
 * tous facultatifs : une boutique qui ne les renseigne pas voit simplement
 * l'écran vide, rien n'est déduit ni présumé à sa place.
 */
export class UpdateFiscalIdentityDto {
  @IsOptional() @IsString() @MaxLength(200) fiscalLegalName?: string;
  @IsOptional() @IsString() @MaxLength(100) fiscalLegalForm?: string;
  @IsOptional() @IsString() @MaxLength(100) fiscalIdNumber?: string;
  @IsOptional() @IsString() @MaxLength(300) fiscalAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) fiscalJurisdiction?: string;
  @IsOptional() @IsString() @MaxLength(100) fiscalRegime?: string;
  @IsOptional() @IsString() @MaxLength(50) fiscalExercice?: string;
  @IsOptional() @IsBoolean() fiscalVatRegistered?: boolean;
}
