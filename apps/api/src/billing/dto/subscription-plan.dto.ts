import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PlanCategory } from "@eleganz/database";

export class CreateSubscriptionPlanDto {
  @IsEnum(PlanCategory)
  category!: PlanCategory;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  monthlyPrice!: number;

  // Frais unique à la souscription — dépend désormais du bouquet choisi
  // (14 oct. 2026, plan commercial), au lieu d'une valeur fixe pour toutes
  // les boutiques.
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveProducts?: number;

  // Liste libre de fonctionnalités incluses — administrable sans migration
  // de base de données (prompt §40 : administration sans programmation).
  @IsOptional()
  features?: Record<string, unknown>;
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveProducts?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  features?: Record<string, unknown>;
}
