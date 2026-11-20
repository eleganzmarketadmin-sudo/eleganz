import { IsIn } from "class-validator";

// Même principe que RequestInstitutionLogoUploadDto
// (institutions/dto/request-institution-logo-upload.dto.ts) : upload direct
// vers R2 via une URL signée, jamais de fichier transitant par notre
// serveur. Voir ComptableService.creerUrlUploadLogo.
const TYPES_AUTORISES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class RequestComptableLogoUploadDto {
  @IsIn(TYPES_AUTORISES, {
    message: "Type d'image non pris en charge (jpeg, png, webp ou gif uniquement).",
  })
  contentType!: (typeof TYPES_AUTORISES)[number];
}
