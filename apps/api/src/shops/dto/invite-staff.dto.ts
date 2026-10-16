import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { MenuGestion, StaffRole } from "@eleganz/database";

export class InviteStaffDto {
  // L'utilisateur doit déjà avoir un compte ELEGANZ (inscription séparée) —
  // pas de création de compte à la volée ici, pour garder l'authentification
  // (mots de passe, etc.) dans un seul endroit : AuthService. Le propriétaire
  // ne connaît pas l'id technique de son collaborateur : il tape son email ou
  // son numéro, et le service le résout lui-même (voir shops.service.ts).
  @IsString()
  identifier!: string;

  // OWNER n'est volontairement pas invitable : il y a un seul propriétaire,
  // fixé à la création de la boutique (shops.service.ts).
  @IsEnum([
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.STOCK_KEEPER,
    StaffRole.SALES_LEAD,
    StaffRole.ACCOUNTANT,
    StaffRole.EXTERNAL_ACCOUNTANT,
  ])
  role!: Exclude<StaffRole, typeof StaffRole.OWNER>;

  // Écrans de menu choisis à la création du profil (16 oct. 2026, point 2
  // des propositions du 16 oct. 2026) — optionnel : si absent, le membre
  // démarre sur la liste par défaut de son rôle (voir
  // ShopsService.menuGestionParDefaut), modifiable ensuite via
  // PATCH :shopId/staff/:staffId.
  @IsOptional()
  @IsArray()
  @IsEnum(MenuGestion, { each: true })
  menuItems?: MenuGestion[];
}
