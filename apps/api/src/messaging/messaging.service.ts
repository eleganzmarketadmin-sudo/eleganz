import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "@eleganz/database";

/**
 * Messagerie interne (15 oct. 2026, demande UX point 4) — fondation
 * volontairement générique : un fil de messages entre deux personnes ou
 * plus, optionnellement rattaché à une boutique (`shopId`). Pas de notion
 * de ticket/statut à cette phase. Chaque message envoyé notifie les autres
 * participants via NotificationsService (voir ce service pour la logique
 * de canal).
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  listerConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async verifierParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException("Vous ne participez pas à cette conversation.");
    }
    return participant;
  }

  async obtenirMessages(userId: string, conversationId: string) {
    await this.verifierParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async demarrerConversation(
    userId: string,
    destinataireId: string,
    subject: string | undefined,
    premierMessage: string,
    shopId?: string,
  ) {
    if (destinataireId === userId) {
      throw new BadRequestException("Impossible de démarrer une conversation avec soi-même.");
    }
    const destinataire = await this.prisma.user.findUnique({ where: { id: destinataireId }, select: { id: true } });
    if (!destinataire) {
      throw new BadRequestException("Destinataire introuvable.");
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        subject,
        shopId,
        participants: { create: [{ userId }, { userId: destinataireId }] },
        messages: { create: { senderId: userId, body: premierMessage } },
      },
      include: { messages: true, participants: true },
    });

    // Lien générique : ce service ne sait pas dans quel espace (admin,
    // Gestion, Secourable, livreur...) le destinataire va le lire —
    // chaque espace a sa propre page de messagerie (voir NotificationBell
    // côté web, qui résout "/messagerie" vers la bonne URL selon l'espace
    // courant). Pas encore de lien profond vers une conversation précise.
    await this.notifications.notifierUtilisateurs([destinataireId], {
      type: NotificationType.NOUVEAU_MESSAGE,
      title: "Nouveau message",
      body: premierMessage.slice(0, 140),
      link: "/messagerie",
    });

    return conversation;
  }

  async envoyerMessage(userId: string, conversationId: string, body: string) {
    await this.verifierParticipant(userId, conversationId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderId: userId, body } }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);

    const autresParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });

    await this.notifications.notifierUtilisateurs(
      autresParticipants.map((p) => p.userId),
      {
        type: NotificationType.NOUVEAU_MESSAGE,
        title: "Nouveau message",
        body: body.slice(0, 140),
        link: "/messagerie",
      },
    );

    return message;
  }

  async marquerLu(userId: string, conversationId: string) {
    await this.verifierParticipant(userId, conversationId);
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * "Contacter la boutique" depuis la page boutique publique (prompt du 15
   * oct. 2026, point 7) — un acheteur ne connaît ni ne choisit de
   * destinataire précis : on résout la propriétaire de la boutique
   * (ownerId) comme interlocuteur. Si un fil existe déjà entre cet
   * acheteur et cette boutique, le message s'y ajoute (pas de nouveau fil
   * à chaque visite) ; sinon un nouveau fil est créé.
   */
  async contacterBoutique(userId: string, shopId: string, subject: string | undefined, message: string) {
    const boutique = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, ownerId: true } });
    if (!boutique) {
      throw new BadRequestException("Boutique introuvable.");
    }
    if (boutique.ownerId === userId) {
      throw new BadRequestException("Impossible de contacter votre propre boutique.");
    }

    const conversationExistante = await this.prisma.conversation.findFirst({
      where: { shopId, participants: { some: { userId } } },
      select: { id: true },
    });

    if (conversationExistante) {
      await this.envoyerMessage(userId, conversationExistante.id, message);
      return this.prisma.conversation.findUnique({
        where: { id: conversationExistante.id },
        include: { messages: true, participants: true },
      });
    }

    return this.demarrerConversation(userId, boutique.ownerId, subject, message, shopId);
  }

  /**
   * "Contacter l'expert" depuis son profil public de l'annuaire /experts
   * (module Experts, 16 oct. 2026, point 2) — même logique que
   * contacterBoutique, mais sans `shopId` (un expert n'appartient à aucune
   * boutique précise) : on dédoublonne simplement sur la paire de
   * participants, jamais de nouveau fil à chaque visite du profil.
   */
  async contacterExpert(userId: string, expertProfileId: string, subject: string | undefined, message: string) {
    const expert = await this.prisma.expertProfile.findUnique({
      where: { id: expertProfileId },
      select: { userId: true, status: true },
    });
    if (!expert || expert.status !== "APPROVED") {
      throw new BadRequestException("Profil expert introuvable.");
    }
    if (expert.userId === userId) {
      throw new BadRequestException("Impossible de vous contacter vous-même.");
    }

    const conversationExistante = await this.prisma.conversation.findFirst({
      where: {
        shopId: null,
        participants: { every: { userId: { in: [userId, expert.userId] } } },
        AND: [{ participants: { some: { userId } } }, { participants: { some: { userId: expert.userId } } }],
      },
      select: { id: true },
    });

    if (conversationExistante) {
      await this.envoyerMessage(userId, conversationExistante.id, message);
      return this.prisma.conversation.findUnique({
        where: { id: conversationExistante.id },
        include: { messages: true, participants: true },
      });
    }

    return this.demarrerConversation(userId, expert.userId, subject, message);
  }
}
