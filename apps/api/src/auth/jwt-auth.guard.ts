import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthenticatedUser {
  id: string;
  role: string;
}

// Vérifie le JWT émis par AuthService et attache l'utilisateur authentifié à
// la requête. C'est la seule source de confiance pour « qui fait cette
// requête » — jamais un id pris dans l'URL ou le corps (exigence du prompt
// maître §11 : les droits sont contrôlés au niveau du service, pas de l'écran).
//
// Audit du 16 oct. 2026 (sécurité) : avant ce correctif, le rôle venait du
// JETON lui-même et un compte suspendu (admin-users.service.ts
// setSuspended) ou un admin révoqué/rétrogradé (admin-team.controller.ts
// revoke/update) restait pleinement autorisé avec son ANCIEN rôle pendant
// toute la durée de vie du jeton (7 jours — voir auth.module.ts) : aucune
// invalidation de session n'existait. Ce garde relit désormais le compte en
// base à chaque requête authentifiée (rôle ET isSuspended), au prix d'une
// requête DB par appel — un suspens/changement de rôle prend effet
// immédiatement plutôt qu'à la prochaine connexion.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Jeton d'authentification manquant.");
    }

    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(
        header.slice("Bearer ".length),
      );
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException("Jeton d'authentification invalide ou expiré.");
    }

    const utilisateur = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isSuspended: true },
    });
    if (!utilisateur) {
      throw new UnauthorizedException("Compte introuvable.");
    }
    if (utilisateur.isSuspended) {
      throw new UnauthorizedException("Ce compte a été suspendu.");
    }

    request.user = { id: utilisateur.id, role: utilisateur.role };
    return true;
  }
}
