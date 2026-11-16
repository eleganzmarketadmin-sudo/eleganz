import { SetMetadata } from "@nestjs/common";
import { InstitutionRole } from "@eleganz/database";

export const INSTITUTION_ROLES_KEY = "institutionRoles";

// Restreint une route du portail Institutions à certains rôles d'équipe
// (ADMINISTRATEUR, GESTIONNAIRE_COMPTE, ANALYSTE_CREDIT, CHARGE_CLIENTELE,
// COMPTABLE). À utiliser avec InstitutionMembershipGuard, qui lit cette
// métadonnée après avoir vérifié l'appartenance à l'institution — même
// principe que @ShopRoles/ShopMembershipGuard côté Gestion.
export const InstitutionRoles = (...roles: InstitutionRole[]) => SetMetadata(INSTITUTION_ROLES_KEY, roles);
