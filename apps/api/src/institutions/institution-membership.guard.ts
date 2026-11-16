import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { INSTITUTION_ROLES_KEY } from "./institution-roles.decorator";
import { exigerInstitutionActive } from "./institution-portal.service";
import { InstitutionRole } from "@eleganz/database";

// À utiliser APRÈS JwtAuthGuard, sur toute route du portail Institutions
// donnant accès à un contenu réel (16 nov. 2026, gestion de crédit PME
// complète) — remplace la répétition manuelle
// `monProfil(user.id) + exigerInstitutionActive(moi)` présente dans chaque
// méthode de InstitutionPortalController avant cette date.
//
// Contrairement à ShopMembershipGuard (qui lit :shopId dans l'URL — un
// utilisateur peut appartenir à plusieurs boutiques), aucune route du
// portail Institutions ne porte :institutionId : un compte ELEGANZ
// n'appartient qu'à UNE SEULE institution (InstitutionStaff.userId
// @unique), donc ce guard résout "mon institution" depuis le JWT et
// l'attache à la requête (`request.institutionId`, lu ensuite via
// @CurrentInstitutionId()) plutôt que depuis un paramètre d'URL.
//
// Toute Institution créée après le 16 nov. 2026 (auto-inscription ou
// création admin) reçoit déjà sa ligne InstitutionStaff(ADMINISTRATEUR) au
// moment de sa création (voir InstitutionPortalService.inscrire et
// AdminInstitutionsService.create) ; les comptes Institution.userId
// antérieurs reçoivent la même ligne via le script de backfill au
// déploiement — ce guard peut donc toujours s'appuyer sur InstitutionStaff
// sans jamais retomber sur Institution.userId directement.
@Injectable()
export class InstitutionMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser; institutionId?: string }>();

    const staff = await this.prisma.institutionStaff.findUnique({
      where: { userId: request.user.id },
      include: { institution: { select: { id: true, status: true } } },
    });
    if (!staff?.active) {
      throw new ForbiddenException("Vous n'avez pas accès au portail institutions.");
    }

    // Un profil PENDING/REJECTED/SUSPENDED existe bel et bien (pas de
    // NotFoundException ici), mais ne doit rien pouvoir faire de plus que
    // consulter son propre statut — même message que exigerInstitutionActive
    // utilisé jusqu'ici dans chaque méthode du contrôleur.
    exigerInstitutionActive(staff.institution);

    const requiredRoles = this.reflector.getAllAndOverride<InstitutionRole[] | undefined>(INSTITUTION_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(staff.role)) {
      throw new ForbiddenException(`Cette action est réservée à : ${requiredRoles.join(", ")}.`);
    }

    request.institutionId = staff.institution.id;
    return true;
  }
}
