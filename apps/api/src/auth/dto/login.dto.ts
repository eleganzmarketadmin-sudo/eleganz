import { IsIn, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  password!: string;

  // Cloisonnement des espaces à la connexion (demande du 10 nov. 2026,
  // point 5 : "aucun user ne peut accéder à un module autre que le module
  // dans lequel il a été créé") — chaque page de connexion dédiée
  // (/admin/connexion, /livreur/connexion, /(gestion)/connexion,
  // /comptable/connexion) envoie désormais son propre espace, vérifié par
  // AuthService.login AVANT même d'émettre un jeton (donc un refus ici ne
  // stocke jamais de session dans le mauvais espace). "comptable" (Mon
  // assistant/Secourable, ajouté le 11 nov. 2026) n'impose volontairement
  // aucun rôle, comme avant — seule la connexion en elle-même redevient
  // obligatoire (voir espaceAuth() côté front, api.ts) ; il reste listé ici
  // uniquement pour que la validation n'y voie pas une valeur invalide.
  // Omis par /marketplace/compte (Marketplace), qui reste ouvert à tout
  // compte ELEGANZ, comme avant.
  @IsOptional()
  @IsIn(["admin", "livreur", "gestion", "comptable"])
  espace?: "admin" | "livreur" | "gestion" | "comptable";
}
