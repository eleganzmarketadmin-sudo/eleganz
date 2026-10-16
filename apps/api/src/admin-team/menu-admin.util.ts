import { MenuAdmin, UserRole } from "@eleganz/database";

// Écrans du Centre de pilotage accordés à un rôle admin par défaut, tant
// que le compte n'a pas reçu de choix explicite (16 oct. 2026 — "donner la
// main aux super administrateurs : accès au menu équipe et possibilité de
// choisir par des coches les menus auxquels l'utilisateur aura accès").
// Fonction pure (pas un provider Nest) pour être importée aussi bien par
// AdminTeamService que par AuthService (qui calcule `adminMenuItems` dans
// GET /auth/me) sans créer de dépendance circulaire entre modules.
export const TOUS_LES_ECRANS_ADMIN: MenuAdmin[] = Object.values(MenuAdmin);

export function menuAdminParDefaut(role: UserRole): MenuAdmin[] {
  switch (role) {
    case UserRole.ADMIN_SUPER:
      return TOUS_LES_ECRANS_ADMIN;
    case UserRole.ADMIN_SALES:
      return [MenuAdmin.PILOTAGE, MenuAdmin.BOUTIQUES, MenuAdmin.SUIVI_COMMANDES, MenuAdmin.TARIFS, MenuAdmin.LITIGES];
    case UserRole.ADMIN_FINANCE:
      return [MenuAdmin.PILOTAGE, MenuAdmin.FINANCE, MenuAdmin.FACTURES, MenuAdmin.TARIFS, MenuAdmin.RELEVES];
    case UserRole.ADMIN_OPS:
      return [MenuAdmin.PILOTAGE, MenuAdmin.SUIVI_COMMANDES, MenuAdmin.LITIGES, MenuAdmin.RELEVES, MenuAdmin.BOUTIQUES];
    case UserRole.ADMIN_LOGISTICS:
      return [MenuAdmin.PILOTAGE, MenuAdmin.LIVREURS, MenuAdmin.SUIVI_COMMANDES];
    case UserRole.ADMIN_MARKETING:
      return [MenuAdmin.PILOTAGE, MenuAdmin.BOUTIQUES, MenuAdmin.MESSAGERIE];
    case UserRole.ADMIN_SUPPORT:
      return [
        MenuAdmin.PILOTAGE,
        MenuAdmin.UTILISATEURS,
        MenuAdmin.LITIGES,
        MenuAdmin.MESSAGERIE,
        MenuAdmin.SUIVI_COMMANDES,
        MenuAdmin.EXPERTS,
      ];
    case UserRole.ADMIN_AUDITOR:
      return [MenuAdmin.PILOTAGE, MenuAdmin.FINANCE, MenuAdmin.FACTURES, MenuAdmin.RELEVES];
    default:
      return [];
  }
}

// Tableau vide (valeur de départ, ou remise à zéro explicite) = pas de
// choix explicite → liste par défaut du rôle ; sinon le choix de
// l'ADMIN_SUPER fait foi tel quel.
export function ecransAdminEffectifs(compte: { role: UserRole; adminMenuItemsOverride: MenuAdmin[] }): MenuAdmin[] {
  return compte.adminMenuItemsOverride.length > 0 ? compte.adminMenuItemsOverride : menuAdminParDefaut(compte.role);
}
