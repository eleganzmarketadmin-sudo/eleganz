import { IsIn } from "class-validator";

// Même principe que RequestLogoUploadDto (shops/dto/request-logo-upload.dto.ts) :
// upload direct vers R2 via une URL signée, jamais de fichier transitant
// par notre serveur. Voir InstitutionPortalService.creerUrlUploadLogo.
const TYPES_AUTORISES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class RequestInstitutionLogoUploadDto {
  @IsIn(TYPES_AUTORISES, {
    message: "Type d'image non pris en charge (jpeg, png, webp ou gif uniquement).",
  })
  contentType!: (typeof TYPES_AUTORISES)[number];
}
