import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

/**
 * Génère une ou plusieurs variantes à partir d'une sélection multiple de
 * tailles et/ou de couleurs (demande du 12 oct. 2026) — une variante par
 * combinaison, pour éviter de ressaisir manuellement chaque SKU. Si les deux
 * listes sont vides, une seule variante "simple" est créée avec `skuBase`
 * comme SKU complet.
 */
export class CreateVariantsBulkDto {
  @IsString()
  @MinLength(1)
  skuBase!: string;

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
