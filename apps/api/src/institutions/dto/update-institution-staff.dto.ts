import { IsArray, IsEnum, IsOptional } from "class-validator";
import { InstitutionRole, MenuInstitution } from "@eleganz/database";

// Mirroring UpdateStaffDto (../../shops/dto/update-staff.dto.ts).
export class UpdateInstitutionStaffDto {
  // ADMINISTRATEUR n'est volontairement pas atteignable ici non plus (voir
  // InviteInstitutionStaffDto).
  @IsOptional()
  @IsEnum([
    InstitutionRole.GESTIONNAIRE_COMPTE,
    InstitutionRole.ANALYSTE_CREDIT,
    InstitutionRole.CHARGE_CLIENTELE,
    InstitutionRole.COMPTABLE,
  ])
  role?: Exclude<InstitutionRole, typeof InstitutionRole.ADMINISTRATEUR>;

  // Tableau vide explicitement envoyé = remet le membre sur la liste par
  // défaut de son rôle ; absent = ne touche pas aux permissions de menu.
  @IsOptional()
  @IsArray()
  @IsEnum(MenuInstitution, { each: true })
  menuItems?: MenuInstitution[];
}
