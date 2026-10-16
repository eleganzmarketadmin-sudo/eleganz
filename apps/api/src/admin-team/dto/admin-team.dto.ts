import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { MenuAdmin, UserRole } from "@eleganz/database";

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

  // Écrans du Centre de pilotage choisis à l'attribution du rôle (16 oct.
  // 2026 — "possibilité de choisir par des coches les menus auxquels
  // l'utilisateur aura accès") — optionnel : si absent, le compte démarre
  // sur la liste par défaut du rôle (AdminTeamService.menuAdminParDefaut),
  // modifiable ensuite via PATCH /admin/team/:userId.
  @IsOptional()
  @IsArray()
  @IsEnum(MenuAdmin, { each: true })
  menuItems?: MenuAdmin[];
}

/**
 * Modification d'un compte admin déjà promu (16 oct. 2026) — changer le
 * rôle et/ou les écrans accordés, réservé aux ADMIN_SUPER (voir
 * AdminTeamController.requireSuperAdmin).
 */
export class UpdateAdminDto {
  @IsOptional()
  @IsEnum(ROLES_ADMIN)
  role?: (typeof ROLES_ADMIN)[number];

  @IsOptional()
  @IsArray()
  @IsEnum(MenuAdmin, { each: true })
  menuItems?: MenuAdmin[];
}
