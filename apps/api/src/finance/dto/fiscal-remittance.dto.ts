import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

// Reversement réel (13 nov. 2026, signalement : "aucune option ... pour les
// reversements") — voir le modèle FiscalRemittance (schema.prisma) : une
// ligne par paiement effectivement fait, jamais une prévision.
export class CreateFiscalRemittanceDto {
  @IsString()
  @MinLength(2)
  periodLabel!: string; // ex. "Janvier 2027", "T1 2027"

  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredAmount?: number; // montant déclaré/dû, si connu avec certitude

  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  reference?: string; // n° de bordereau, de quittance ou de virement

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateFiscalRemittanceDto {
  @IsOptional() @IsString() @MinLength(2) periodLabel?: string;
  @IsOptional() @IsDateString() periodFrom?: string;
  @IsOptional() @IsDateString() periodTo?: string;
  @IsOptional() @IsNumber() @Min(0) declaredAmount?: number;
  @IsOptional() @IsNumber() @Min(0) paidAmount?: number;
  @IsOptional() @IsString() devise?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}
