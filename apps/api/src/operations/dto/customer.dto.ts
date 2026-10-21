import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateCustomerDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
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
  @MaxLength(50)
  method?: string;

  // `@IsDateString` ajouté le 21 oct. 2026 (audit sécurité) — sans
  // décorateur de type, une chaîne non-date passait silencieusement jusqu'à
  // `new Date(...)`, produisant un `Invalid Date` stocké sans erreur.
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
