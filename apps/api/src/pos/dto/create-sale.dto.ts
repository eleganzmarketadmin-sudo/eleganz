import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PaymentMethod } from "@eleganz/database";

export class SaleLineDto {
  // Vide = vente rapide d'un article non catalogué (complément stratégique §3)
  @IsOptional()
  @IsString()
  variantId?: string;

  @IsString()
  label!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class SalePaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  confirmed?: boolean;
}

export class CreateSaleDto {
  // Optionnel côté client : le contrôleur l'écrase toujours avec l'utilisateur
  // authentifié (voir pos.controller.ts) — gardé ici seulement pour permettre
  // au contrôleur de vérifier une incohérence explicite si le front en envoie un.
  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments!: SalePaymentDto[];

  @IsOptional()
  @IsEnum(["USD", "CDF"])
  currency?: "USD" | "CDF";
}

export class SyncSaleDto extends CreateSaleDto {
  // Généré côté client avant tout appel réseau (docs/ARCHITECTURE_HORS_LIGNE.md)
  // — clé d'idempotence de la synchronisation hors-ligne.
  @IsString()
  clientOperationId!: string;
}
