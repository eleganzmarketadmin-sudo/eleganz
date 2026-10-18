import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationType } from "@eleganz/database";

/**
 * Notifications in-app (15 oct. 2026, demande UX point 7) — fondation
 * transverse : n'importe quel service de la plateforme peut appeler
 * `notifierUtilisateurs` sans se soucier des canaux, ce service est le
 * seul point qui consulte PlatformSettings pour savoir s'il doit
 * effectivement écrire la ligne (et sur quel canal). Email et SMS restent
 * de simples interrupteurs non câblés tant qu'aucun fournisseur d'envoi
 * n'est branché (voir schema.prisma, PlatformSettings) : les activer ne
 * fait aujourd'hui rien de plus que l'in-app, par choix explicite plutôt
 * que d'écrire une ligne "channel: EMAIL" qui ne serait jamais envoyée.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifierUtilisateurs(
    userIds: string[],
    params: { type: NotificationType; title: string; body: string; link?: string },
  ) {
    // Correctif audit du 18 oct. 2026 : un tableau vide (ex. zéro compte
    // ADMIN_* trouvé pour une escalade — voir
    // PasswordResetService.demanderReinitialisation) faisait disparaître la
    // notification sans aucune trace, alors que l'appelant peut avoir déjà
    // dit à la personne « votre demande a été transmise ». Ce marqueur
    // greppable (NOTIFICATION_DESTINATAIRES_VIDE) rend ce cas repérable
    // dans les logs sans changer le comportement (toujours un no-op, qui
    // reste le bon choix générique pour un primitif partagé par une
    // douzaine d'appelants).
    if (userIds.length === 0) {
      this.logger.warn(`NOTIFICATION_DESTINATAIRES_VIDE aucun destinataire pour la notification "${params.title}"`);
      return;
    }
    const uniques = [...new Set(userIds)];

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: { notificationsInAppEnabled: true },
    });
    // Pas de ligne par défaut tant qu'un admin n'a jamais configuré
    // PlatformSettings — on considère l'in-app actif par défaut (valeur de
    // repli de la colonne elle-même), jamais l'inverse : un utilisateur ne
    // doit pas perdre silencieusement ses notifications faute de réglage.
    if (settings && !settings.notificationsInAppEnabled) return;

    await this.prisma.notification.createMany({
      data: uniques.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      })),
    });
  }

  list(userId: string, options: { nonLuesSeulement?: boolean } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(options.nonLuesSeulement ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async compterNonLues(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async marquerLue(userId: string, id: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id } });
    if (notification.userId !== userId) {
      throw new ForbiddenException("Cette notification ne vous appartient pas.");
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  marquerToutesLues(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
