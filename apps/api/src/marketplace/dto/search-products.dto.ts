import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

// Couche 1 (structurée) du moteur de recherche hybride décrit dans le prompt
// maître §12 : filtres exacts + recherche texte simple. La compréhension en
// langage naturel ("chemise homme bleu ciel XL") et le classement en 3
// niveaux (exact / proche / recommandé) sont phase 8 du plan — pas encore
// implémentés, volontairement, pour ne pas construire sur un socle instable.
export class SearchProductsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  // Filtre "livre chez moi" (prompt du 15 oct. 2026) — id d'une City de
  // référence (voir GeoModule), jamais une saisie libre.
  @IsOptional()
  @IsString()
  cityId?: string;
}
