import { IsArray, IsEnum, IsOptional } from "class-validator";
import { MenuGestion, StaffRole } from "@eleganz/database";

/**
 * Modification d'un profil d'équipe déjà actif (16 oct. 2026, point 2 des
 * propositions du 16 oct. 2026) — permet de changer le rôle et/ou les
 * écrans de menu accordés ("décocher/cocher ou modifier plus tard"), ce
 * qu'aucun endpoint ne permettait jusqu'ici (seules l'invitation et la
 * suppression existaient). Les deux champs sont optionnels : on peut
 * changer l'un sans toucher à l'autre.
 */
export class UpdateStaffDto {
  // OWNER n'est volontairement pas atteignable ici non plus (voir
  // InviteStaffDto) : il n'y a qu'un seul propriétaire, jamais réassigné
  // par ce chemin.
  @IsOptional()
  @IsEnum([
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.STOCK_KEEPER,
    StaffRole.SALES_LEAD,
    StaffRole.ACCOUNTANT,
    StaffRole.EXTERNAL_ACCOUNTANT,
  ])
  role?: Exclude<StaffRole, typeof StaffRole.OWNER>;

  // Tableau vide explicitement envoyé = remet le membre sur la liste par
  // défaut de son rôle (ShopsService.menuGestionParDefaut) ; absent =
  // ne touche pas aux permissions de menu.
  @IsOptional()
  @IsArray()
  @IsEnum(MenuGestion, { each: true })
  menuItems?: MenuGestion[];
}
