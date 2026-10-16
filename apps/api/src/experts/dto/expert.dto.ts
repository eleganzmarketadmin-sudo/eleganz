import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ShopExpertScope } from "@eleganz/database";

// Liste exportée pour être réutilisée par le guard/les contrôleurs sans
// dupliquer les valeurs — même esprit que ROLES_ADMIN dans admin-team.dto.ts.
export const SCOPES_EXPERT = [ShopExpertScope.FINANCE, ShopExpertScope.COMMANDES, ShopExpertScope.CATALOGUE] as const;

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
