import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { SHOP_ROLES_KEY } from "./roles.decorator";
import type { StaffRole } from "@eleganz/database";

// À utiliser APRÈS JwtAuthGuard. Vérifie que l'utilisateur authentifié est
// bien staff de la boutique ciblée par :shopId dans l'URL — c'est ce qui
// empêche un vendeur de lire ou modifier les données d'une autre boutique
// (séparation des données de gestion privées, complément stratégique §14).
// Si la route porte @ShopRoles(...), vérifie en plus que le rôle du staff y
// figure (ex. un caissier ne peut pas créer de fournisseurs — prompt §10 :
// « un caissier peut enregistrer des ventes sans pouvoir modifier... »).
@Injectable()
export class ShopMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    // @types/express@5 type les paramètres de route en `string | string[]`
    // (pour les segments répétés) — ":shopId" est toujours un seul segment ici.
    const shopId = request.params.shopId as string;
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

    // getAllAndOverride : un décorateur posé sur la méthode l'emporte sur celui
    // posé sur la classe (ex. SuppliersController restreint toute la classe,
    // mais une méthode pourrait l'élargir si besoin un jour).
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(SHOP_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Cette action est réservée à : ${requiredRoles.join(", ")}.`,
      );
    }

    return true;
  }
}
