import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProductDto {
  // `@MaxLength` ajoutés le 21 oct. 2026 (audit sécurité) — sans borne,
  // n'importe quel champ texte pouvait recevoir plusieurs Mo de données
  // (répétable sur de nombreux produits/variants via l'ajout en masse),
  // gonflant la base et pouvant ralentir le service (DoS applicatif léger).
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsOptional()
  @IsArray()
  images?: string[];
}
