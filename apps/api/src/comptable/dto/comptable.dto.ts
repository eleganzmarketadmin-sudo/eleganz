import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import {
  ComptableActivityCategory,
  ComptableDebtType,
  ComptableFlowCategory,
  ComptableFlowDirection,
  ComptableCurrency,
  ComptableRentFrequency,
} from "@eleganz/database";

export class CreateActivityDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ComptableActivityCategory)
  category!: ComptableActivityCategory;
}

/**
 * Saisie simplifiée à une ligne par jour (prompt §5) : jusqu'à 4 montants
 * (ventes/dépenses × CDF/USD) envoyés en une seule requête. Le service les
 * éclate en autant de ComptableEntry que de montants réellement fournis —
 * jamais de ligne à zéro créée pour un champ laissé vide.
 */
export class QuickEntryDto {
  @IsString()
  activityId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salesCdf?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salesUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expensesCdf?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expensesUsd?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Saisie différée synchronisée au retour du réseau (prompt du 13 oct. 2026,
 * point 2) — même DTO que QuickEntryDto, avec l'identifiant d'opération
 * généré côté client avant tout appel réseau (voir apps/web/app/lib/offline-queue.ts
 * et le même principe déjà en place pour les ventes Caisse,
 * apps/api/src/pos/dto/create-sale.dto.ts). Permet de rejouer la
 * synchronisation sans risque de doublon si la réponse réseau s'est perdue.
 */
export class SyncQuickEntryDto extends QuickEntryDto {
  @IsString()
  clientOperationId!: string;
}

export class CreateEntryDto {
  @IsString()
  activityId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(ComptableFlowDirection)
  direction!: ComptableFlowDirection;

  @IsEnum(ComptableFlowCategory)
  category!: ComptableFlowCategory;

  @IsEnum(ComptableCurrency)
  currency!: ComptableCurrency;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateDebtDto {
  @IsString()
  activityId!: string;

  @IsEnum(ComptableDebtType)
  type!: ComptableDebtType;

  @IsString()
  @MinLength(1)
  counterpartyName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(ComptableCurrency)
  currency!: ComptableCurrency;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class AddDebtPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRentalUnitDto {
  @IsString()
  activityId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  tenantName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  rentAmount!: number;

  @IsEnum(ComptableCurrency)
  currency!: ComptableCurrency;

  @IsOptional()
  @IsEnum(ComptableRentFrequency)
  frequency?: ComptableRentFrequency;

  @IsOptional()
  @IsDateString()
  leaseStart?: string;

  @IsOptional()
  @IsDateString()
  leaseEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;
}

export class RecordRentPaymentDto {
  @IsString()
  periodLabel!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedAmount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedAmount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddRentExpenseDto {
  @IsString()
  category!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(ComptableCurrency)
  currency!: ComptableCurrency;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateWorkerRemittanceDto {
  @IsString()
  activityId!: string;

  @IsString()
  @MinLength(1)
  workerName!: string;

  @IsString()
  periodLabel!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredRevenue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredExpenses?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @IsEnum(ComptableCurrency)
  currency!: ComptableCurrency;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ChoosePlanDto {
  @IsIn(["MONTHLY", "YEARLY"])
  plan!: "MONTHLY" | "YEARLY";
}
