import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsNumber, Min, MinLength } from "class-validator";
import { TYPES_INSTITUTION, TypeInstitution } from "../../admin-institutions/dto/admin-institutions.dto";

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

// Auto-inscription institution (14 nov. 2026, revirement sur la décision
// initiale — voir le commentaire sur InstitutionStatus dans schema.prisma) :
// le compte ELEGANZ existe déjà à ce stade (créé juste avant via
// POST /auth/register avec role=INSTITUTION_STAFF, même séquence que
// DeliveryService.registerDriver pour les livreurs) ; ce DTO ne porte donc
// plus d'identifiant, seulement le profil institution lui-même, toujours
// créé au statut PENDING (voir InstitutionPortalService.inscrire), jamais
// ACTIVE directement.
export class RegisterInstitutionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(TYPES_INSTITUTION)
  type!: TypeInstitution;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
