import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreerAbonnementPushDto } from "./dto/push-subscription.dto";

@Injectable()
export class PushSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `endpoint` est unique côté navigateur : un `upsert` dessus gère aussi
   * bien un premier abonnement qu'un réabonnement après changement de
   * compte sur le même appareil (ex. déconnexion/reconnexion), sans ligne
   * en double à nettoyer.
   */
  abonner(userId: string, dto: CreerAbonnementPushDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
    });
  }

  async desabonner(userId: string, endpoint: string) {
    // deleteMany plutôt que delete : si l'abonnement a déjà été retiré (ou
    // appartient à quelqu'un d'autre — ne doit jamais arriver, mais on ne
    // fait pas confiance à l'endpoint envoyé par le client), silencieux
    // plutôt qu'une 404/403 sur une simple action de nettoyage.
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  pourUtilisateurs(userIds: string[]) {
    return this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  }

  async supprimerExpiree(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
