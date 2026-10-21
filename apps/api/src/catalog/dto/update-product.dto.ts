import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

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

  // URLs d'images hébergées ailleurs (le compte de stockage objet ELEGANZ
  // n'existe pas encore — voir PROJECT_STATUS.md). Une fois ce compte créé,
  // ce champ pourra aussi recevoir des URLs issues d'un vrai upload, sans
  // changer la forme de la donnée.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
