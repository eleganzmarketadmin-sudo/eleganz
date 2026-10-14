import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateReceptionStockDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  coutUnitaire!: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsBoolean()
  onCredit?: boolean;
}
