import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

// À utiliser APRÈS JwtAuthGuard. Vérifie que l'utilisateur authentifié est
// bien staff de la boutique ciblée par :shopId dans l'URL — c'est ce qui
// empêche un vendeur de lire ou modifier les données d'une autre boutique
// (séparation des données de gestion privées, complément stratégique §14).
@Injectable()
export class ShopMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const shopId = request.params.shopId;
    if (!shopId) return true; // route sans :shopId, rien à vérifier ici

    // Les rôles admin globaux passent — leur accès est filtré ailleurs
    // (Centre de pilotage), pas au niveau de l'appartenance à une boutique.
    if (request.user.role.startsWith("ADMIN_")) return true;

    const membership = await this.prisma.shopStaff.findUnique({
      where: { shopId_userId: { shopId, userId: request.user.id } },
    });

    if (!membership?.active) {
      throw new ForbiddenException("Vous n'avez pas accès à cette boutique.");
    }

    return true;
  }
}
