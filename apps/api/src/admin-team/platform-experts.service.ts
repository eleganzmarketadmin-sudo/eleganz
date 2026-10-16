import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ShopExpertEngagementStatus, ShopExpertInviteStatus } from "@eleganz/database";
import type { InvitePlatformExpertDto } from "./dto/platform-expert.dto";

// Pendant plateforme du module Experts (voir apps/api/src/experts/
// experts.service.ts, section "Invitations par lien") — même principe
// (lien à durée limitée, acceptation réservée à un compte ELEGANZ ayant
// déjà un ExpertProfile, révocation à tout moment), sans shopId : les
// périmètres accordés sont des écrans MenuAdmin (Centre de pilotage)
// plutôt que des ShopExpertScope. Demande du 16 oct. 2026, point 2 :
// "ajouter le bloc d'invitation Experts externes... comme déjà actif dans
// eleganz gestion".
@Injectable()
export class PlatformExpertsService {
  constructor(private readonly prisma: PrismaService) {}

  async creerInvite(createdByUserId: string, dto: InvitePlatformExpertDto) {
    const duree = dto.dureeValiditeJours && dto.dureeValiditeJours > 0 ? Math.min(dto.dureeValiditeJours, 90) : 14;
    const expiresAt = new Date(Date.now() + duree * 24 * 60 * 60 * 1000);
    return this.prisma.platformExpertInvite.create({
      data: {
        token: randomBytes(24).toString("hex"),
        createdByUserId,
        scopes: dto.scopes,
        expiresAt,
      },
    });
  }

  listInvites() {
    return this.prisma.platformExpertInvite.findMany({ orderBy: { createdAt: "desc" } });
  }

  async revoquerInvite(inviteId: string) {
    const invite = await this.prisma.platformExpertInvite.findUnique({ where: { id: inviteId } });
    if (!invite) {
      throw new NotFoundException("Invitation introuvable.");
    }
    if (invite.status !== ShopExpertInviteStatus.PENDING) {
      throw new ConflictException("Cette invitation n'est plus en attente.");
    }
    return this.prisma.platformExpertInvite.update({ where: { id: inviteId }, data: { status: ShopExpertInviteStatus.REVOKED } });
  }

  // Aperçu public du lien (avant connexion) — périmètres proposés
  // seulement, jamais de donnée interne (même règle que apercuInvite côté
  // boutique).
  async apercuInvite(token: string) {
    const invite = await this.prisma.platformExpertInvite.findUnique({
      where: { token },
      select: { status: true, expiresAt: true, scopes: true },
    });
    if (!invite) {
      throw new NotFoundException("Lien d'invitation introuvable.");
    }
    return invite;
  }

  // Accepter requiert d'être déjà connecté avec un compte ELEGANZ ayant
  // complété au moins une candidature expert minimale — même règle que
  // accepterInvite côté boutique ; la modération admin ne porte que sur la
  // visibilité dans l'annuaire public, pas sur cet accès accordé
  // individuellement.
  async accepterInvite(token: string, userId: string) {
    const invite = await this.prisma.platformExpertInvite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException("Lien d'invitation introuvable.");
    }
    if (invite.status !== ShopExpertInviteStatus.PENDING) {
      throw new ConflictException("Ce lien d'invitation n'est plus valide.");
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.platformExpertInvite.update({ where: { id: invite.id }, data: { status: ShopExpertInviteStatus.EXPIRED } });
      throw new ConflictException("Ce lien d'invitation a expiré.");
    }

    const profil = await this.prisma.expertProfile.findUnique({ where: { userId } });
    if (!profil) {
      throw new BadRequestException(
        "Complétez d'abord votre profil expert (rubrique « Devenir expert ») avant d'accepter cette invitation.",
      );
    }

    const existant = await this.prisma.platformExpertEngagement.findUnique({
      where: { expertProfileId: profil.id },
    });

    const [engagement] = await this.prisma.$transaction([
      existant
        ? this.prisma.platformExpertEngagement.update({
            where: { id: existant.id },
            data: { scopes: invite.scopes, status: ShopExpertEngagementStatus.ACTIVE, revokedAt: null },
          })
        : this.prisma.platformExpertEngagement.create({
            data: {
              expertProfileId: profil.id,
              scopes: invite.scopes,
              invitedByUserId: invite.createdByUserId,
            },
          }),
      this.prisma.platformExpertInvite.update({
        where: { id: invite.id },
        data: { status: ShopExpertInviteStatus.ACCEPTED, expertProfileId: profil.id },
      }),
    ]);

    return engagement;
  }

  listEngagements() {
    return this.prisma.platformExpertEngagement.findMany({
      include: { expertProfile: { select: { id: true, headline: true, user: { select: { fullName: true, email: true, phone: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoquerEngagement(engagementId: string) {
    const engagement = await this.prisma.platformExpertEngagement.findUnique({ where: { id: engagementId } });
    if (!engagement) {
      throw new NotFoundException("Accès expert introuvable.");
    }
    return this.prisma.platformExpertEngagement.update({
      where: { id: engagementId },
      data: { status: ShopExpertEngagementStatus.REVOKED, revokedAt: new Date() },
    });
  }
}
