import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateAiServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  creditCost!: number;

  @IsOptional()
  @IsString()
  provider?: string;
}

export class UpdateAiServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  creditCost?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
