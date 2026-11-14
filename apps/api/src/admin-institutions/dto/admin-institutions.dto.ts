import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const TYPES_INSTITUTION = ["MICROFINANCE", "BANQUE", "COOPERATIVE", "AUTRE"] as const;
export type TypeInstitution = (typeof TYPES_INSTITUTION)[number];

// Création d'une institution partenaire (14 nov. 2026, décision verrouillée :
// "sur invitation ELEGANZ uniquement") — `identifiant` (email ou téléphone)
// doit correspondre à un compte ELEGANZ déjà existant, même principe que
// GrantAdminRoleDto (admin-team/dto/admin-team.dto.ts) : jamais de mot de
// passe fixé par l'admin pour le compte de quelqu'un d'autre.
export class CreateInstitutionDto {
  @IsString()
  @MinLength(3)
  identifiant!: string;

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

export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(TYPES_INSTITUTION)
  type?: TypeInstitution;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
