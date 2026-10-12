import { IsEnum, IsString } from "class-validator";
import { UserRole } from "@eleganz/database";

// Rôles qu'un administrateur peut attribuer depuis cet écran — jamais BUYER,
// SHOP_OWNER, SHOP_STAFF ou DRIVER, qui s'attribuent par leurs propres
// parcours (inscription, invitation d'équipe boutique, etc.).
export const ROLES_ADMIN = [
  UserRole.ADMIN_SUPER,
  UserRole.ADMIN_SALES,
  UserRole.ADMIN_FINANCE,
  UserRole.ADMIN_OPS,
  UserRole.ADMIN_LOGISTICS,
  UserRole.ADMIN_MARKETING,
  UserRole.ADMIN_SUPPORT,
  UserRole.ADMIN_AUDITOR,
] as const;

export class GrantAdminRoleDto {
  // Email ou numéro de téléphone du compte ELEGANZ existant à promouvoir —
  // jamais de création de compte depuis cet écran, la personne doit déjà
  // s'être inscrite normalement.
  @IsString()
  identifiant!: string;

  @IsEnum(ROLES_ADMIN)
  role!: (typeof ROLES_ADMIN)[number];
}
