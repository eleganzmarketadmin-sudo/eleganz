import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from "class-validator";

/**
 * Identité du Comptable (assistant ELEGANZ) sur les documents PDF qu'il
 * exporte (20 nov. 2026, étalage du en-tête/pied de page personnalisés déjà
 * livré pour le portail Institution) — même convention que
 * UpdateInstitutionSettingsDto (institutions/dto/update-institution-
 * settings.dto.ts) : tous les champs sont facultatifs et peuvent être
 * effacés en envoyant une chaîne vide. Le nom affiché sur ces documents
 * reste `User.fullName` (déjà modifiable via PATCH /auth/me) — jamais
 * dupliqué ici.
 */
export class UpdateComptableSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  // Vide = retire le logo ; sinon doit être une URL valide — on ne valide
  // pas l'URL d'une chaîne vide, qui sert justement à effacer le champ.
  @ValidateIf((o) => !!o.logoUrl)
  @IsUrl({}, { message: "Le logo doit être une URL valide (https://...)." })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  headerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerNote?: string;
}
