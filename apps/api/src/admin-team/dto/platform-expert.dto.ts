import { ArrayMinSize, IsArray, IsEnum, IsOptional } from "class-validator";
import { MenuAdmin } from "@eleganz/database";

// Invitation d'un expert externe au niveau plateforme (16 oct. 2026, point 2
// — "ajouter le bloc d'invitation Experts externes... Choisir les
// périmètres accordés comme déjà actif dans eleganz gestion") : même forme
// que InviteExpertDto côté boutique, mais les périmètres sont des écrans
// MenuAdmin plutôt que des ShopExpertScope.
export class InvitePlatformExpertDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(MenuAdmin, { each: true })
  scopes!: MenuAdmin[];

  @IsOptional()
  dureeValiditeJours?: number;
}
