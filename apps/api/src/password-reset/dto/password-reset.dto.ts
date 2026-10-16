import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// Mot de passe oublié, option "solliciter l'admin" (16 oct. 2026, point 1).
// `identifiant` : ce que la personne connaît déjà (email ou téléphone de
// son compte) — jamais vérifié ici (évite de révéler si un compte existe).
export class DemanderReinitialisationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifiant!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class ResoudreReinitialisationDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  newPassword?: string;
}

