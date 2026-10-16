import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Ajoute une catégorie au référentiel global (16 oct. 2026) — voir
 * ProductCategory dans schema.prisma. Contrairement à VariantOption, ce
 * référentiel est partagé entre toutes les boutiques : une nouvelle valeur
 * ajoutée depuis une boutique devient aussitôt disponible pour toutes,
 * y compris dans le filtre catégorie du Marketplace.
 */
export class CreateProductCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
