import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  // Étiquette "Nouveau" / "Nouvel arrivage" (2 nov. 2026) — voir
  // Product.isNewArrival dans schema.prisma.
  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  // Paiement échelonné (26 nov. 2026) — voir Product.paiementEchelonne* dans
  // schema.prisma. `nombreTranches`/`tauxInteretPct` sont validés comme
  // obligatoires ENSEMBLE avec `actif: true` par CatalogService.updateProduct
  // (validation de service, pas de colonne), jamais ici : rester cohérent
  // avec le PATCH partiel déjà en place pour tout le reste de ce DTO.
  @IsOptional()
  @IsBoolean()
  paiementEchelonneActif?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(24)
  paiementEchelonneNombreTranches?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  paiementEchelonneTauxInteretPct?: number;

  // URLs d'images hébergées ailleurs (le compte de stockage objet ELEGANZ
  // n'existe pas encore — voir PROJECT_STATUS.md). Une fois ce compte créé,
  // ce champ pourra aussi recevoir des URLs issues d'un vrai upload, sans
  // changer la forme de la donnée.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
