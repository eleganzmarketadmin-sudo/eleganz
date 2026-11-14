import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

// Prêt réellement obtenu (19 oct. 2026) — voir Loan dans schema.prisma.
// `compteAccountCode` est le code du compte de trésorerie qui a reçu le
// décaissement (ex. "5711" pour la caisse USD générique, ou "521-01" pour
// un compte bancaire dédié déjà créé via TresorerieComptesService) —
// saisie libre, validée par AccountingService.enregistrer() au moment de
// comptabiliser le décaissement.
export class CreateLoanDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsNumber()
  @Min(0)
  tauxAnnuel!: number;

  @IsInt()
  @Min(1)
  dureeMois!: number;

  @IsOptional()
  @IsIn(["USD", "CDF"])
  devise?: "USD" | "CDF";

  @IsString()
  @MinLength(1)
  compteAccountCode!: string;

  @IsOptional()
  @IsDateString()
  dateObtention?: string;

  // Décaissement issu d'une décision ACCORDE du portail institutions (14
  // nov. 2026) — quand renseigné, montant/tauxAnnuel/dureeMois ci-dessus
  // sont ignorés au profit de ceux de la décision (LoansService.create),
  // pour qu'une boutique ne puisse jamais décaisser des conditions
  // différentes de celles réellement accordées par l'institution.
  @IsOptional()
  @IsString()
  decisionId?: string;
}
