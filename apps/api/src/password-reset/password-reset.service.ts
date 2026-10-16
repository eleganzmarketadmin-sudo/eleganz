import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType, PasswordResetRequestStatus } from "@eleganz/database";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";

const SELECTION_DEMANDE = {
  id: true,
  identifiant: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
} as const;

/**
 * Mot de passe oublié (16 oct. 2026, point 1) : "donner la possibilité en
 * cas de mot de passe oublié à l'utilisateur de réinitialiser et recevoir
 * le code (par email ou sms) et l'option alternative de solliciter
 * l'admin de la plateforme". Seule cette seconde option est construite
 * ici — recevoir un code par email ou WhatsApp suppose un fournisseur
 * d'envoi externe qui n'est pas encore branché (voir
 * NotificationsService : email/SMS restent de simples interrupteurs non
 * câblés tant qu'aucun fournisseur n'est choisi).
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Toujours la même réponse générique, qu'un compte corresponde ou non à
  // l'identifiant tapé — même principe que login() dans AuthService : ne
  // jamais laisser deviner si un email/téléphone a un compte ELEGANZ.
  async demanderReinitialisation(identifiant: string, message?: string) {
    const identifiantNettoye = identifiant.trim();
    const utilisateur = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifiantNettoye }, { phone: identifiantNettoye }] },
    });

    // Anti-spam simple : une demande déjà en attente pour le même
    // identifiant depuis moins de 10 minutes ne déclenche pas une
    // deuxième notification aux admins — la réponse à la personne reste
    // la même dans tous les cas.
    const demandeRecente = await this.prisma.passwordResetRequest.findFirst({
      where: {
        identifiant: identifiantNettoye,
        status: PasswordResetRequestStatus.PENDING,
        createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });

    if (!demandeRecente) {
      await this.prisma.passwordResetRequest.create({
        data: {
          identifiant: identifiantNettoye,
          userId: utilisateur?.id,
          message,
        },
      });

      if (utilisateur) {
        const admins = await this.prisma.user.findMany({
          where: { role: { in: [...ROLES_ADMIN] } },
          select: { id: true },
        });
        await this.notifications.notifierUtilisateurs(
          admins.map((a) => a.id),
          {
            type: NotificationType.AUTRE,
            title: "Demande de réinitialisation de mot de passe",
            body: `${utilisateur.fullName} (${identifiantNettoye}) a demandé une réinitialisation de mot de passe.`,
            link: "/admin/utilisateurs",
          },
        );
      }
    }

    return {
      message:
        "Votre demande a été transmise à l'administration ELEGANZ. Vous serez contacté·e pour la suite de la réinitialisation.",
    };
  }

  lister(statusFiltre?: PasswordResetRequestStatus) {
    return this.prisma.passwordResetRequest.findMany({
      where: statusFiltre ? { status: statusFiltre } : undefined,
      select: SELECTION_DEMANDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Réinitialise le mot de passe du compte visé par la demande et marque
   * celle-ci résolue. Même logique que AdminUsersService.resetPassword
   * (mot de passe temporaire généré si aucun n'est fourni, jamais stocké
   * en clair) — l'admin doit ensuite communiquer ce mot de passe à la
   * personne par le canal de son choix (téléphone, WhatsApp...), faute de
   * canal automatisé pour l'instant.
   */
  async resoudre(requestId: string, resolvedByUserId: string, newPassword?: string) {
    const demande = await this.prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
    if (!demande) {
      throw new NotFoundException("Demande introuvable.");
    }
    if (demande.status !== PasswordResetRequestStatus.PENDING) {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    if (!demande.userId) {
      throw new ConflictException(
        "Aucun compte ELEGANZ ne correspond à l'identifiant indiqué — vérifiez-le avec la personne avant de réinitialiser.",
      );
    }

    const motDePasse = newPassword ?? crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(motDePasse, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: demande.userId }, data: { passwordHash } }),
      this.prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: { status: PasswordResetRequestStatus.RESOLVED, resolvedByUserId, resolvedAt: new Date() },
      }),
    ]);

    return {
      motDePasseTemporaire: newPassword ? undefined : motDePasse,
    };
  }

  async rejeter(requestId: string, resolvedByUserId: string) {
    const demande = await this.prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
    if (!demande) {
      throw new NotFoundException("Demande introuvable.");
    }
    if (demande.status !== PasswordResetRequestStatus.PENDING) {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    return this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: PasswordResetRequestStatus.REJECTED, resolvedByUserId, resolvedAt: new Date() },
    });
  }
}
