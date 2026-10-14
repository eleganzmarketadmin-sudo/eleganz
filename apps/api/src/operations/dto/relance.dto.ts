import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRelanceDto {
  @IsIn(["CLIENT", "FOURNISSEUR"])
  direction!: "CLIENT" | "FOURNISSEUR";

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsString()
  @MinLength(1)
  message!: string;
}
