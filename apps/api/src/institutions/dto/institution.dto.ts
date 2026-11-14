import { IsBoolean, IsIn, IsOptional, IsString, IsNumber, Min, MinLength } from "class-validator";

// Accès accordé par une boutique à une institution déjà partenaire ELEGANZ
// (14 nov. 2026) — voir ShopInstitutionAccess dans schema.prisma. La
// boutique choisit l'institution dans le catalogue fourni par
// GET /institutions/catalogue, jamais une saisie libre d'identifiant.
export class GrantInstitutionAccessDto {
  @IsString()
  @MinLength(1)
  institutionId!: string;
}

// Décision d'une institution sur le dossier crédit d'une boutique qui lui a
// accordé l'accès (14 nov. 2026) — voir LoanDecision dans schema.prisma.
export class CreateLoanDecisionDto {
  @IsIn(["ACCORDE", "REFUSE"])
  statut!: "ACCORDE" | "REFUSE";

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsNumber()
  @Min(0)
  tauxAnnuel!: number;

  @IsNumber()
  @Min(1)
  dureeMois!: number;

  @IsOptional()
  @IsString()
  note?: string;

  // "Suivi des remboursements optionnel" (14 nov. 2026) — l'institution
  // choisit ici, au moment de sa décision, si elle veut pouvoir
  // comptabiliser elle-même les échéances une fois le prêt décaissé. Sans
  // effet si statut=REFUSE.
  @IsOptional()
  @IsBoolean()
  autoriserSuiviRemboursement?: boolean;
}
