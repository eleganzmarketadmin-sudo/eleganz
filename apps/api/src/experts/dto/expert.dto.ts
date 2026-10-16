import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { ExpertDocumentType, ExpertProfileTemplate, ShopExpertScope } from "@eleganz/database";

// Liste exportée pour être réutilisée par le guard/les contrôleurs sans
// dupliquer les valeurs — même esprit que ROLES_ADMIN dans admin-team.dto.ts.
export const SCOPES_EXPERT = [ShopExpertScope.FINANCE, ShopExpertScope.COMMANDES, ShopExpertScope.CATALOGUE] as const;

export const TEMPLATES_EXPERT = [
  ExpertProfileTemplate.CLASSIQUE,
  ExpertProfileTemplate.MODERNE,
  ExpertProfileTemplate.CREATIF,
] as const;

export const TYPES_DOCUMENT_EXPERT = [
  ExpertDocumentType.CV,
  ExpertDocumentType.DIPLOME,
  ExpertDocumentType.CERTIFICATION,
  ExpertDocumentType.AUTRE,
] as const;

// Types de fichiers acceptés — une image (scan) ou un PDF pour les
// documents, une image seule pour la photo de profil.
const CONTENT_TYPES_DOCUMENT = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const CONTENT_TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"] as const;

// Candidature expert — n'importe quel compte ELEGANZ peut postuler, quel que
// soit son rôle (demande du 16 oct. 2026, point 2 : "les experts peuvent
// postuler"). Le statut repart systématiquement en PENDING_REVIEW côté
// service dès qu'un champ change, pour qu'une modification ne contourne
// jamais la modération admin déjà décidée.
export class CandidaterExpertDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  headline!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  bio!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  domaines!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditions?: string;

  // Gabarit de présentation du profil public (demande du 16 oct. 2026,
  // point 2) — purement visuel, voir ExpertProfileTemplate.
  @IsOptional()
  @IsIn(TEMPLATES_EXPERT)
  template?: ExpertProfileTemplate;
}

export class RequestExpertUploadDto {
  @IsIn(CONTENT_TYPES_PHOTO)
  contentType!: (typeof CONTENT_TYPES_PHOTO)[number];
}

export class DefinirPhotoExpertDto {
  @IsUrl()
  url!: string;
}

export class RequestExpertDocumentUploadDto {
  @IsIn(CONTENT_TYPES_DOCUMENT)
  contentType!: (typeof CONTENT_TYPES_DOCUMENT)[number];
}

// Candidature complète (demande du 16 oct. 2026, point 3) — CV, diplômes,
// certifications et tout autre document : chacun est d'abord téléversé via
// RequestExpertDocumentUploadDto (URL signée), puis enregistré ici avec son
// URL définitive.
export class AjouterDocumentExpertDto {
  @IsIn(TYPES_DOCUMENT_EXPERT)
  type!: ExpertDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @IsUrl()
  url!: string;
}

// Personne de référence à contacter (demande du 16 oct. 2026, point 3).
export class AjouterReferenceExpertDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  role?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  contact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

// Invitation envoyée par une boutique — périmètres choisis au cas par cas,
// jamais une liste figée identique pour tous les experts (décision
// verrouillée lors du cadrage).
export class InviteExpertDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SCOPES_EXPERT, { each: true })
  scopes!: ShopExpertScope[];

  @IsOptional()
  dureeValiditeJours?: number;
}

export class ModererExpertDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
