import { IsIn } from "class-validator";

// Même principe que RequestInstitutionLogoUploadDto/RequestComptableLogoUploadDto
// (institutions/dto, comptable/dto) : upload direct vers R2 via une URL
// signée, jamais de fichier transitant par notre serveur. Voir
// AdminSettingsService.creerUrlUploadLogo.
const TYPES_AUTORISES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class RequestPlatformLogoUploadDto {
  @IsIn(TYPES_AUTORISES, {
    message: "Type d'image non pris en charge (jpeg, png, webp ou gif uniquement).",
  })
  contentType!: (typeof TYPES_AUTORISES)[number];
}
