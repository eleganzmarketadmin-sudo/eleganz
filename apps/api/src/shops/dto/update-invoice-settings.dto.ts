import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from "class-validator";

/**
 * Identité d'une boutique sur ses documents imprimés (factures, bons de
 * livraison, tickets...) — prompt du 12 oct. 2026 : chaque vendeur doit
 * pouvoir personnaliser ses propres documents avec ses informations. Tous
 * les champs sont facultatifs et peuvent être effacés en envoyant une
 * chaîne vide.
 */
export class UpdateInvoiceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  invoiceAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoicePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  // Vide = retire le logo ; sinon doit être une URL valide — on ne valide
  // pas l'URL d'une chaîne vide, qui sert justement à effacer le champ.
  @ValidateIf((o) => !!o.invoiceLogoUrl)
  @IsUrl({}, { message: "Le logo doit être une URL valide (https://...)." })
  invoiceLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  invoiceFooterNote?: string;
}
