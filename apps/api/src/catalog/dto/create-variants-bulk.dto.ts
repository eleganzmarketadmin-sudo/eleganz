import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

/**
 * Génère une ou plusieurs variantes à partir d'une sélection multiple de
 * tailles et/ou de couleurs (demande du 12 oct. 2026) — une variante par
 * combinaison, pour éviter de ressaisir manuellement chaque SKU. Si les deux
 * listes sont vides, une seule variante "simple" est créée avec `skuBase`
 * comme SKU complet.
 */
export class CreateVariantsBulkDto {
  @IsString()
  @MinLength(1)
  skuBase!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsNumber()
  @Min(0)
  sellPrice!: number;

  @IsOptional()
  @IsIn(["USD", "CDF"])
  currency?: "USD" | "CDF";

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStockQty?: number;
}
