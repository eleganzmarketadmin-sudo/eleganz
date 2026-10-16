import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ExpertStatus, NotificationType, ShopExpertEngagementStatus, ShopExpertInviteStatus, ShopExpertScope } from "@eleganz/database";
import type { CandidaterExpertDto, InviteExpertDto } from "./dto/expert.dto";

// Module EXPERTS (16 oct. 2026, point 2) — voir packages/database/prisma/
// schema.prisma pour le détail du schéma et les 4 décisions verrouillées
// (modération admin avant annuaire public ; invitation par lien réservée à
// un compte ELEGANZ existant ; périmètres d'accès choisis au cas par cas par
// la boutique ; conditions affichées à titre informatif seulement, aucune
// passerelle de paiement).
@Injectable()
export class ExpertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Candidature / profil personnel -------------------------------------

  // Toute personne ayant un compte ELEGANZ peut postuler ou mettre à jour sa
  // candidature, quel que soit son rôle actuel sur la plateforme — ce n'est
  // pas un rôle système, juste un profil optionnel attaché à son compte.
  // Toute modification repart en PENDING_REVIEW : on ne laisse jamais une
  // modification de profil contourner silencieusement la modération déjà
  // accordée (ex. réécrire sa bio après approbation sans repasser devant un
  // admin serait une faille de modération).
  async candidater(userId: string, dto: CandidaterExpertDto) {
    return this.prisma.expertProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: dto.headline,
        bio: dto.bio,
        domaines: dto.domaines,
        conditions: dto.conditions,
        status: ExpertStatus.PENDING_REVIEW,
      },
      update: {
        headline: dto.headline,
        bio: dto.bio,
        domaines: dto.domaines,
        conditions: dto.conditions,
        status: ExpertStatus.PENDING_REVIEW,
        statusNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  }

  monProfil(userId: string) {
    return this.prisma.expertProfile.findUnique({ where: { userId } });
  }

  // Boutiques où cette personne est actuellement engagée comme expert — vue
  // personnelle, pas l'annuaire public.
  async mesEngagements(userId: string) {
    const profil = await this.prisma.expertProfile.findUnique({ where: { userId } });
    if (!profil) return [];
    return this.prisma.shopExpertEngagement.findMany({
      where: { expertProfileId: profil.id, status: ShopExpertEngagementStatus.ACTIVE },
      include: { shop: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Annuaire public (status APPROVED uniquement) ------------------------

  async rechercher(q?: string) {
    const experts = await this.prisma.expertProfile.findMany({
      where: {
        status: ExpertStatus.APPROVED,
        ...(q
          ? {
              OR: [
                { headline: { contains: q, mode: "insensitive" } },
                { bio: { contains: q, mode: "insensitive" } },
                { domaines: { has: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        headline: true,
        bio: true,
        domaines: true,
        conditions: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return experts;
  }

  async profilPublic(id: string) {
    const expert = await this.prisma.expertProfile.findFirst({
      where: { id, status: ExpertStatus.APPROVED },
      select: {
        id: true,
        userId: true,
        headline: true,
        bio: true,
        domaines: true,
        conditions: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
    });
    if (!expert) {
      throw new NotFoundException("Profil expert introuvable.");
    }
    return expert;
  }

  // --- Modération admin -----------------------------------------------------

  listerEnAttente() {
    return this.prisma.expertProfile.findMany({
      where: { status: ExpertStatus.PENDING_REVIEW },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  private async changerStatut(id: string, status: ExpertStatus, adminId: string, note?: string) {
    const profil = await this.prisma.expertProfile.update({
      where: { id },
      data: { status, statusNote: note, reviewedById: adminId, reviewedAt: new Date() },
    });
    await this.notifications.notifierUtilisateurs([profil.userId], {
      type: NotificationType.AUTRE,
      title: "Votre candidature expert",
      body:
        status === ExpertStatus.APPROVED
          ? "Votre profil expert a été approuvé et apparaît désormais dans l'annuaire ELEGANZ."
          : status === ExpertStatus.REJECTED
            ? "Votre candidature expert n'a pas été retenue."
            : "Votre profil expert a été suspendu par l'administration.",
      link: "/experts/moi",
    });
    return profil;
  }

  approuver(id: string, adminId: string, note?: string) {
    return this.changerStatut(id, ExpertStatus.APPROVED, adminId, note);
  }

  rejeter(id: string, adminId: string, note?: string) {
    return this.changerStatut(id, ExpertStatus.REJECTED, adminId, note);
  }

  suspendre(id: string, adminId: string, note?: string) {
    return this.changerStatut(id, ExpertStatus.SUSPENDED, adminId, note);
  }

  // --- Invitations par lien (boutique → expert) ------------------------------

  async creerInvite(shopId: string, createdByUserId: string, dto: InviteExpertDto) {
    const duree = dto.dureeValiditeJours && dto.dureeValiditeJours > 0 ? Math.min(dto.dureeValiditeJours, 90) : 14;
    const expiresAt = new Date(Date.now() + duree * 24 * 60 * 60 * 1000);
    return this.prisma.shopExpertInvite.create({
      data: {
        token: randomBytes(24).toString("hex"),
        shopId,
        createdByUserId,
        scopes: dto.scopes,
        expiresAt,
      },
    });
  }

  listInvitesBoutique(shopId: string) {
    return this.prisma.shopExpertInvite.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoquerInvite(shopId: string, inviteId: string) {
    const invite = await this.prisma.shopExpertInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.shopId !== shopId) {
      throw new NotFoundException("Invitation introuvable.");
    }
    if (invite.status !== ShopExpertInviteStatus.PENDING) {
      throw new ConflictException("Cette invitation n'est plus en attente.");
    }
    return this.prisma.shopExpertInvite.update({ where: { id: inviteId }, data: { status: ShopExpertInviteStatus.REVOKED } });
  }

  // Aperçu public du lien (avant connexion) — nom de la boutique et
  // périmètres proposés seulement, jamais de donnée interne.
  async apercuInvite(token: string) {
    const invite = await this.prisma.shopExpertInvite.findUnique({
      where: { token },
      select: { status: true, expiresAt: true, scopes: true, shop: { select: { name: true } } },
    });
    if (!invite) {
      throw new NotFoundException("Lien d'invitation introuvable.");
    }
    return invite;
  }

  // Accepter un lien d'invitation requiert d'être déjà connecté avec un
  // compte ELEGANZ (décision verrouillée) — pas de création de compte à la
  // volée depuis ce lien. La boutique a choisi personnellement cette
  // personne : contrairement à l'annuaire public, accepter son invitation ne
  // requiert pas d'être déjà APPROVED par un admin, seulement d'avoir rempli
  // au moins une candidature expert minimale (le formulaire "Devenir
  // expert") — la modération admin ne porte que sur la visibilité publique.
  async accepterInvite(token: string, userId: string) {
    const invite = await this.prisma.shopExpertInvite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException("Lien d'invitation introuvable.");
    }
    if (invite.status !== ShopExpertInviteStatus.PENDING) {
      throw new ConflictException("Ce lien d'invitation n'est plus valide.");
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.shopExpertInvite.update({ where: { id: invite.id }, data: { status: ShopExpertInviteStatus.EXPIRED } });
      throw new ConflictException("Ce lien d'invitation a expiré.");
    }

    const profil = await this.prisma.expertProfile.findUnique({ where: { userId } });
    if (!profil) {
      throw new BadRequestException(
        "Complétez d'abord votre profil expert (rubrique « Devenir expert ») avant d'accepter cette invitation.",
      );
    }

    const existant = await this.prisma.shopExpertEngagement.findUnique({
      where: { shopId_expertProfileId: { shopId: invite.shopId, expertProfileId: profil.id } },
    });

    const [engagement] = await this.prisma.$transaction([
      existant
        ? this.prisma.shopExpertEngagement.update({
            where: { id: existant.id },
            data: { scopes: invite.scopes, status: ShopExpertEngagementStatus.ACTIVE, revokedAt: null },
          })
        : this.prisma.shopExpertEngagement.create({
            data: {
              shopId: invite.shopId,
              expertProfileId: profil.id,
              scopes: invite.scopes,
              invitedByUserId: invite.createdByUserId,
            },
          }),
      this.prisma.shopExpertInvite.update({
        where: { id: invite.id },
        data: { status: ShopExpertInviteStatus.ACCEPTED, expertProfileId: profil.id },
      }),
    ]);

    return engagement;
  }

  // --- Accès engagés (boutique → liste + révocation) ------------------------

  listEngagementsBoutique(shopId: string) {
    return this.prisma.shopExpertEngagement.findMany({
      where: { shopId },
      include: { expertProfile: { select: { id: true, headline: true, user: { select: { fullName: true, email: true, phone: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoquerEngagement(shopId: string, engagementId: string) {
    const engagement = await this.prisma.shopExpertEngagement.findUnique({ where: { id: engagementId } });
    if (!engagement || engagement.shopId !== shopId) {
      throw new NotFoundException("Accès expert introuvable pour cette boutique.");
    }
    return this.prisma.shopExpertEngagement.update({
      where: { id: engagementId },
      data: { status: ShopExpertEngagementStatus.REVOKED, revokedAt: new Date() },
    });
  }
}
