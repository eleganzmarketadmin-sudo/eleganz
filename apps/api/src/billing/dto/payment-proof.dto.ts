import { IsIn, IsOptional, IsString } from "class-validator";

/** Préparation de l'upload d'une preuve de paiement (16 nov. 2026). Types acceptés : même liste que StorageService.creerUrlUpload. */
export class CreerUploadPreuvePaiementDto {
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  contentType!: string;
}

export class SoumettrePreuvePaiementDto {
  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
