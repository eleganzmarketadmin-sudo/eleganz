import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { InstitutionRole, MenuInstitution } from "@eleganz/database";

// Mirroring InviteStaffDto (../../shops/dto/invite-staff.dto.ts) pour
// l'équipe institution (16 nov. 2026, demande du propriétaire, point 2 :
// "l'institution doit pouvoir comme dans Gestion créer les users et
// définir les rôles et périmètre de fonction").
export class InviteInstitutionStaffDto {
  // La personne doit déjà avoir un compte ELEGANZ (inscription séparée) —
  // pas de création de compte à la volée ici, même principe que
  // ShopsService.inviteStaff. L'ADMINISTRATEUR ne connaît pas l'id
  // technique de son collaborateur : il tape son email ou son numéro, et
  // le service le résout lui-même.
  @IsString()
  identifier!: string;

  // ADMINISTRATEUR n'est volontairement pas invitable : il y a un seul
  // propriétaire/contact historique par institution (Institution.userId),
  // grandfathered en ADMINISTRATEUR, jamais réassigné par ce chemin — même
  // principe que StaffRole.OWNER côté Gestion.
  @IsEnum([
    InstitutionRole.GESTIONNAIRE_COMPTE,
    InstitutionRole.ANALYSTE_CREDIT,
    InstitutionRole.CHARGE_CLIENTELE,
    InstitutionRole.COMPTABLE,
  ])
  role!: Exclude<InstitutionRole, typeof InstitutionRole.ADMINISTRATEUR>;

  // Écrans de menu choisis à la création du profil — optionnel : si absent,
  // le membre démarre sur la liste par défaut de son rôle (voir
  // InstitutionStaffService.menuInstitutionParDefaut), modifiable ensuite
  // via PATCH institution-portal/staff/:staffId.
  @IsOptional()
  @IsArray()
  @IsEnum(MenuInstitution, { each: true })
  menuItems?: MenuInstitution[];
}
