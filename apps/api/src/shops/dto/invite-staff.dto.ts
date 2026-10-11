import { IsEnum, IsString } from "class-validator";
import { StaffRole } from "@eleganz/database";

export class InviteStaffDto {
  // L'utilisateur doit déjà avoir un compte ELEGANZ (inscription séparée) —
  // pas de création de compte à la volée ici, pour garder l'authentification
  // (mots de passe, etc.) dans un seul endroit : AuthService.
  @IsString()
  userId!: string;

  // OWNER n'est volontairement pas invitable : il y a un seul propriétaire,
  // fixé à la création de la boutique (shops.service.ts).
  @IsEnum([
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.STOCK_KEEPER,
    StaffRole.SALES_LEAD,
    StaffRole.ACCOUNTANT,
  ])
  role!: Exclude<StaffRole, typeof StaffRole.OWNER>;
}
