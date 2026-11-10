import { IsString, MinLength } from "class-validator";

// Changement de mot de passe depuis l'espace "Mon compte" (demande du 10
// nov. 2026, point 3 : "Ajouter les options modifications de mot de passe
// dans le menu paramètre") — volontairement une route séparée de
// `PATCH /auth/me` (UpdateMeDto), qui exclut explicitement le mot de passe
// car "un changement de mot de passe mériterait sa propre vérification" :
// ici, l'ancien mot de passe doit être fourni et revérifié côté serveur
// avant d'accepter le nouveau.
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  // Même longueur minimale que ce que RegisterDto impose déjà à la
  // création du compte (cohérence de la politique de mot de passe).
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
