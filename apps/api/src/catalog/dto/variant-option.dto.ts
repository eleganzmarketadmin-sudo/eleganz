import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { VariantOptionKind } from "@eleganz/database";

/**
 * Ajoute une valeur à la liste déroulante taille/couleur de la boutique
 * (demande du 12 oct. 2026) — remplace la saisie libre pour éviter les
 * doublons par faute de frappe.
 */
export class CreateVariantOptionDto {
  @IsEnum(VariantOptionKind)
  kind!: VariantOptionKind;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  value!: string;
}
