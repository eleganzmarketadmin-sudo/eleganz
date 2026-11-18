import { IsEnum, IsOptional } from "class-validator";
import { SecteurActiviteBoutique } from "@eleganz/database";

/**
 * Secteur d'activité de la boutique (18 nov. 2026, chantier "gestion de
 * risque autonome" Phase 2 — périmètre redéfini par le propriétaire :
 * ELEGANZ fournit cette information aux institutions financières
 * partenaires pour les aider à analyser une candidature de crédit, elle ne
 * s'en sert jamais elle-même pour restreindre ou conditionner quoi que ce
 * soit). `@IsOptional()` laisse passer `null` sans validation d'enum,
 * exactement ce qu'il faut pour permettre à une boutique d'effacer son
 * choix — même convention que UpdateShopDescriptionDto.
 */
export class UpdateShopSecteurActiviteDto {
  @IsOptional()
  @IsEnum(SecteurActiviteBoutique)
  secteurActivite?: SecteurActiviteBoutique | null;
}
