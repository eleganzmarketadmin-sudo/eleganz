import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

// Mise à jour du profil personnel du compte connecté (demande du 16 oct.
// 2026, point 2 : le numéro de téléphone doit être visible et modifiable
// dans le profil de chaque type d'utilisateur). Volontairement limité à
// l'identité du compte — jamais le rôle, jamais le mot de passe (un
// changement de mot de passe mériterait sa propre vérification, hors
// périmètre de cette demande).
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
