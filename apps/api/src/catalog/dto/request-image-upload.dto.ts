import { IsIn } from "class-validator";

const TYPES_AUTORISES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class RequestImageUploadDto {
  @IsIn(TYPES_AUTORISES, {
    message: "Type d'image non pris en charge (jpeg, png, webp ou gif uniquement).",
  })
  contentType!: (typeof TYPES_AUTORISES)[number];
}
