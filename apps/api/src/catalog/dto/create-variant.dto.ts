import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateVariantDto {
  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  // Jamais exposé aux autres vendeurs (DECISIONS.md, confidentialité des données de gestion)
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
