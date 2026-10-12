import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole } from "@eleganz/database";
import { ROLES_ADMIN } from "./dto/admin-team.dto";

@Injectable()
export class AdminTeamService {
  constructor(private readonly prisma: PrismaService) {}

  listAdmins() {
    return this.prisma.user.findMany({
      where: { role: { in: [...ROLES_ADMIN] } },
      select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async grantAdminRole(identifiant: string, role: UserRole) {
    const estEmail = identifiant.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: identifiant } : { phone: identifiant },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. La personne doit d'abord créer son propre compte (acheteur ou vendeur), puis être promue ici.",
      );
    }
    return this.prisma.user.update({
      where: { id: utilisateur.id },
      data: { role },
      select: { id: true, fullName: true, email: true, phone: true, role: true },
    });
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
      data: { role: UserRole.BUYER },
      select: { id: true, fullName: true, email: true, phone: true, role: true },
    });
  }
}
