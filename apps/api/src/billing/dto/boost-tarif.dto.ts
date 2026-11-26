import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { BoostCible } from "@eleganz/database";

export class CreateBoostTarifDto {
  @IsEnum(BoostCible)
  cible!: BoostCible;

  @IsInt()
  @Min(1)
  dureeJours!: number;

  @IsNumber()
  @Min(0)
  prix!: number;
}

export class UpdateBoostTarifDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  dureeJours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prix?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
