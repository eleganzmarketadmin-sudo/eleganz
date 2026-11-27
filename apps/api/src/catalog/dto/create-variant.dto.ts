import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateVariantDto {
  @IsString()
  sku!: string;

  // Code-barres/QR du fabricant (21 nov. 2026) — voir le commentaire sur
  // Variant.barcode dans schema.prisma. Facultatif ; généralement laissé
  // vide à la création et rempli ensuite via UpdateVariantDto (scan depuis
  // l'écran Catalogue, une variante à la fois).
  @IsOptional()
  @IsString()
  barcode?: string;

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
  // validé côté service : rejeté avec une erreur explicite (pas ignoré
  // silencieusement, corrigé le 12 nov. 2026) s'il n'est pas strictement
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

  // `null` explicite retire le code-barres déjà enregistré (voir le
  // commentaire sur Variant.barcode dans schema.prisma).
  @IsOptional()
  @IsString()
  barcode?: string | null;

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

  // Seuil d'alerte de stock bas (27 nov. 2026, demande : "Ajouter un menu ou
  // option d'alerte sur les articles et leurs quantité pour organiser un
  // approvisionnement") — champ `Variant.lowStockAt` déjà présent dans le
  // schéma (valeur par défaut 3) mais jamais exposé à l'édition jusqu'ici.
  // Un article est "en stock bas" dès que `stockQty <= lowStockAt`, comparé
  // à l'affichage uniquement (voir page Stock & CMV), jamais stocké.
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockAt?: number;
}
