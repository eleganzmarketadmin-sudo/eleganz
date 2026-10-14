import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateComptablePlanDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  monthlyPrice!: number;

  @IsNumber()
  @Min(0)
  yearlyPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxActivities?: number;

  // Liste libre, administrable sans migration — mêmes clés que
  // BOUQUETS_COMPTABLE_DE_DEPART (historiqueIllimite, comparaisonPeriodes,
  // rappelsAgenda, exportDossierFinancement).
  @IsOptional()
  features?: Record<string, unknown>;
}

export class UpdateComptablePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActivities?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  features?: Record<string, unknown>;
}
