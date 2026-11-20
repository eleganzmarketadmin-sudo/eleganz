import { IsEmail, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from "class-validator";

/**
 * Identité d'une institution sur les documents qu'elle exporte depuis son
 * portail (20 nov. 2026, demande : "menu paramètre pour le portail
 * institution afin de libérer les infos avec les infos d'identification de
 * l'institution... avec entête personnalisé et/ou pied de page") — même
 * convention que UpdateInvoiceSettingsDto (shops/dto/update-invoice-
 * settings.dto.ts) : tous les champs sont facultatifs et peuvent être
 * effacés en envoyant une chaîne vide. `name`/`type` ne sont volontairement
 * PAS éditables ici : ce sont des champs validés à l'inscription,
 * modifiables seulement via le support ELEGANZ (admin-institutions),
 * jamais en libre-service.
 */
export class UpdateInstitutionSettingsDto {
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

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
