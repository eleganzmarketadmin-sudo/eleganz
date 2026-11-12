import { IsIn } from "class-validator";

// 13 nov. 2026 (signalement : "pour les url de logo des boutique prière
// donner la possibilité en plus du lien de charger une image") — même
// principe que RequestExpertUploadDto (experts/dto/expert.dto.ts) et
// RequestImageUploadDto (catalog/dto/request-image-upload.dto.ts) : upload
// direct vers R2 via une URL signée, jamais de fichier transitant par notre
// serveur. Voir ShopsService.creerUrlUploadLogo.
const TYPES_AUTORISES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class RequestLogoUploadDto {
  @IsIn(TYPES_AUTORISES, {
    message: "Type d'image non pris en charge (jpeg, png, webp ou gif uniquement).",
  })
  contentType!: (typeof TYPES_AUTORISES)[number];
}
