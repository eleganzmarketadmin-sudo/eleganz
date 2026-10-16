import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MenuAdmin, UserRole } from "@eleganz/database";
import { ROLES_ADMIN } from "./dto/admin-team.dto";
import { ecransAdminEffectifs, menuAdminParDefaut } from "./menu-admin.util";

@Injectable()
export class AdminTeamService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [...ROLES_ADMIN] } },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        adminMenuItemsOverride: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    // Liste effective des écrans accordés par compte admin (16 oct. 2026 —
    // "possibilité de choisir par des coches les menus auxquels
    // l'utilisateur aura accès") — calculée ici plutôt que recalculée côté
    // front, pour que l'écran Équipe admin et AdminShell affichent toujours
    // la même vérité.
    return admins.map((admin) => ({ ...admin, menuItems: ecransAdminEffectifs(admin) }));
  }

  async grantAdminRole(identifiant: string, role: UserRole, menuItems?: MenuAdmin[]) {
    const estEmail = identifiant.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: identifiant } : { phone: identifiant },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. La personne doit d'abord créer son propre compte (acheteur ou vendeur), puis être promue ici.",
      );
    }
    const mis_a_jour = await this.prisma.user.update({
      where: { id: utilisateur.id },
      data: { role, adminMenuItemsOverride: menuItems ?? [] },
      select: { id: true, fullName: true, email: true, phone: true, role: true, adminMenuItemsOverride: true },
    });
    return { ...mis_a_jour, menuItems: ecransAdminEffectifs(mis_a_jour) };
  }

  /**
   * Modification d'un compte admin déjà promu (16 oct. 2026) — changer le
   * rôle et/ou les écrans accordés, sans repasser par une révocation suivie
   * d'une nouvelle promotion. `menuItems` envoyé explicitement (même `[]`)
   * remplace le choix existant ; absent = ne touche pas aux permissions de
   * menu en place.
   */
  async updateAdmin(userId: string, role?: UserRole, menuItems?: MenuAdmin[]) {
    const compte = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!ROLES_ADMIN.includes(compte.role as (typeof ROLES_ADMIN)[number])) {
      throw new BadRequestException("Ce compte n'est pas un compte administrateur.");
    }
    const mis_a_jour = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(role !== undefined && { role }),
        ...(menuItems !== undefined && { adminMenuItemsOverride: menuItems }),
      },
      select: { id: true, fullName: true, email: true, phone: true, role: true, adminMenuItemsOverride: true },
    });
    return { ...mis_a_jour, menuItems: ecransAdminEffectifs(mis_a_jour) };
  }

  /**
   * Retire les droits d'administration (retour au rôle ACHETEUR, le plus
   * neutre). Refuse qu'un admin se retire lui-même — évite qu'une équipe
   * ne se retrouve accidentellement sans aucun accès au centre de pilotage.
   */
  async revokeAdminRole(userId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new BadRequestException(
        "Vous ne pouvez pas retirer vos propres droits d'administration. Demandez à un autre administrateur de le faire.",
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.BUYER, adminMenuItemsOverride: [] },
      select: { id: true, fullName: true, email: true, phone: true, role: true },
    });
  }

  // Écrans par défaut d'un rôle admin, exposés pour que l'écran Équipe
  // admin pré-remplisse les cases à cocher à l'attribution (16 oct. 2026).
  defautsParRole(): Record<string, MenuAdmin[]> {
    return Object.fromEntries(ROLES_ADMIN.map((role) => [role, menuAdminParDefaut(role)]));
  }
}
