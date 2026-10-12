import { Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const SELECTION_PUBLIQUE = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isSuspended: true,
  createdAt: true,
} as const;

/**
 * Gestion des comptes utilisateurs depuis le Centre de pilotage (prompt du
 * 12 oct. 2026) : recherche, détail, réinitialisation de mot de passe et
 * blocage/déblocage — ce qui manquait pour que l'équipe ELEGANZ puisse
 * dépanner un compte sans intervention directe en base de données.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche par nom, email ou téléphone — vide renvoie les comptes les
   * plus récents plutôt que toute la base d'un coup.
   */
  async search(query?: string) {
    const q = query?.trim();
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      select: SELECTION_PUBLIQUE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async findOne(userId: string) {
    const utilisateur = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...SELECTION_PUBLIQUE,
        ownedShops: { select: { id: true, name: true, status: true } },
        shopMemberships: {
          where: { active: true },
          select: { role: true, shop: { select: { id: true, name: true } } },
        },
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!utilisateur) {
      throw new NotFoundException("Compte introuvable.");
    }
    return utilisateur;
  }

  /**
   * Génère un mot de passe temporaire si l'admin n'en fournit pas un —
   * évite de demander à l'admin d'en inventer un, et ne stocke jamais le
   * mot de passe en clair : seul le hash est conservé, la valeur en clair
   * n'est renvoyée qu'une fois, dans la réponse de cet appel.
   */
  async resetPassword(userId: string, newPassword?: string) {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const motDePasse = newPassword ?? crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(motDePasse, 10);
    const utilisateur = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: SELECTION_PUBLIQUE,
    });
    return {
      utilisateur,
      // Uniquement si généré automatiquement : un mot de passe fourni par
      // l'admin n'a pas besoin d'être renvoyé, il le connaît déjà.
      motDePasseTemporaire: newPassword ? undefined : motDePasse,
    };
  }

  async setSuspended(userId: string, isSuspended: boolean) {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended },
      select: SELECTION_PUBLIQUE,
    });
  }
}
