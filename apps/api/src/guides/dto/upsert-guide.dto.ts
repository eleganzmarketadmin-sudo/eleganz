import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

/**
 * Création et modification utilisent le même DTO (champs optionnels côté
 * update géré par le service, pas par deux DTO distincts — même convention
 * que le reste de l'API pour les formulaires courts).
 */
export class UpsertGuideDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  titre!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categorie!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  motsCles?: string[];

  @IsString()
  @MinLength(1)
  contenuAgent!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imagesAgent?: string[];

  @IsOptional()
  @IsString()
  contenuClient?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imagesClient?: string[];

  @IsOptional()
  @IsBoolean()
  partagePublicActif?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleFaq?: boolean;
}
