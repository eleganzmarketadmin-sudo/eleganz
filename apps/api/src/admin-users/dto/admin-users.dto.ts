import { IsOptional, IsString, MinLength } from "class-validator";

/**
 * Réinitialisation du mot de passe d'un compte par un administrateur
 * (prompt du 12 oct. 2026 — "Centre de pilotage", gestion des comptes
 * utilisateurs). Si aucun mot de passe n'est fourni, un mot de passe
 * temporaire est généré par le serveur et renvoyé une seule fois dans la
 * réponse, à communiquer vous-même à la personne concernée.
 */
export class AdminResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  newPassword?: string;
}
