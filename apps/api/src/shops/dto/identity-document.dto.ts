import { IsEnum, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { TypeDocumentIdentite } from "@eleganz/database";

// Documents d'identité (18 nov. 2026, chantier "gestion de risque autonome"
// Phase 4, volet KYC) — même pattern en deux temps que
// CreerUploadPreuvePaiementDto/SoumettrePreuvePaiementDto
// (apps/api/src/billing/dto/payment-proof.dto.ts) : une route génère une URL
// d'upload signée (StorageService.creerUrlUpload), l'autre enregistre le
// document une fois le fichier réellement envoyé sur le stockage.
export class CreerUploadDocumentIdentiteDto {
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  contentType!: string;
}

export class SoumettreDocumentIdentiteDto {
  @IsEnum(TypeDocumentIdentite)
  type!: TypeDocumentIdentite;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
