import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCustomerDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RecordCreditPaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  // Ajoutés le 14 oct. 2026 (chantier SYSCOHADA, créances & dettes) — pour
  // garder trace du règlement (ReglementClient), pas seulement la nouvelle
  // valeur du solde cumulé.
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;
}
