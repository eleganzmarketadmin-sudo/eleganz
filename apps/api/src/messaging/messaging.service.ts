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

    await this.notifications.notifierUtilisateurs([destinataireId], {
      type: NotificationType.NOUVEAU_MESSAGE,
      title: "Nouveau message",
      body: premierMessage.slice(0, 140),
      link: `/messagerie/${conversation.id}`,
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
        link: `/messagerie/${conversationId}`,
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
}
