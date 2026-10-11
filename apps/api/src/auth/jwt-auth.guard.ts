import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  role: string;
}

// Vérifie le JWT émis par AuthService et attache l'utilisateur authentifié à
// la requête. C'est la seule source de confiance pour « qui fait cette
// requête » — jamais un id pris dans l'URL ou le corps (exigence du prompt
// maître §11 : les droits sont contrôlés au niveau du service, pas de l'écran).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Jeton d'authentification manquant.");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(
        header.slice("Bearer ".length),
      );
      request.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException("Jeton d'authentification invalide ou expiré.");
    }
  }
}
