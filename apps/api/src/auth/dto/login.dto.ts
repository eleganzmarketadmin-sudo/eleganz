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
  // (/admin/connexion, /livreur/connexion, /(gestion)/connexion) envoie
  // désormais son propre espace, vérifié par AuthService.login AVANT même
  // d'émettre un jeton (donc un refus ici ne stocke jamais de session dans
  // le mauvais espace). Omis par /marketplace/compte (Marketplace +
  // "Mon assistant"/Secourable) qui reste volontairement ouvert à tout
  // compte ELEGANZ, comme avant.
  @IsOptional()
  @IsIn(["admin", "livreur", "gestion"])
  espace?: "admin" | "livreur" | "gestion";
}
