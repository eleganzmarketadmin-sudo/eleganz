import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateVariantDto {
  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  // Jamais exposé aux autres vendeurs (DECISIONS.md, confidentialité des données de gestion)
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsNumber()
  @Min(0)
  sellPrice!: number;

  // Prix barré de référence pour une promotion (19 oct. 2026) — optionnel,
  // validé côté service : ignoré silencieusement s'il n'est pas strictement
  // supérieur à sellPrice, jamais un badge "promo" trompeur.
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsIn(["USD", "CDF"])
  currency?: "USD" | "CDF";

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStockQty?: number;
}

export class UpdateVariantDto {
  // Référence, taille, couleur, prix d'achat (20 oct. 2026) — un article mal
  // saisi à la création devait auparavant être supprimé et recréé ; tous les
  // champs d'une variante sont désormais modifiables après coup, pas
  // seulement le prix de vente et la promotion.
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  size?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  // Envoyer `null` explicitement retire la promotion en cours.
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null;
}
