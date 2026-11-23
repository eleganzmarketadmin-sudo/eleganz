import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

/**
 * Génère une ou plusieurs variantes à partir d'une sélection multiple de
 * tailles et/ou de couleurs (demande du 12 oct. 2026) — une variante par
 * combinaison, pour éviter de ressaisir manuellement chaque SKU. Si les deux
 * listes sont vides, une seule variante "simple" est créée.
 *
 * La référence interne (SKU) de chaque variante n'est plus construite à
 * partir d'un préfixe fourni par le client (23 nov. 2026, retour
 * propriétaire — une référence courte et alphanumérique est préférable à une
 * concaténation catégorie/nom/taille/couleur, surtout une fois convertie en
 * code-barres) : elle est désormais tirée côté service, voir
 * CatalogService.addVariantsBulk / tirerReferenceCourte.
 */
export class CreateVariantsBulkDto {
  // Code-barres/QR du fabricant (21 nov. 2026, retour client : "le champ code
  // barres ajouté à la création des articles n'est pas visible") — facultatif,
  // et n'a de sens que lorsque cette requête ne crée QU'UNE SEULE variante
  // (un même code-barres ne peut pas désigner plusieurs combinaisons
  // taille/couleur à la fois) : rejeté par le service si sizes/colors
  // produisent plus d'une combinaison. Pour un lot de plusieurs variantes, le
  // code-barres de chacune reste à ajouter après coup (UpdateVariantDto).
  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsNumber()
  @Min(0)
  sellPrice!: number;

  @IsOptional()
  @IsIn(["USD", "CDF"])
  currency?: "USD" | "CDF";

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStockQty?: number;
}
