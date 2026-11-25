import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ShopModerationFlagStatus } from "@eleganz/database";
import type { IssueSignalement } from "./dto/moderation.dto";

/**
 * Écran admin du contrôle anti-blanchiment/produits illicites (24 nov.
 * 2026) — voir le commentaire sur ShopModerationFlag dans schema.prisma.
 * CatalogService bloque déjà la création/modification et crée le
 * signalement ; ce service ne fait que la consultation/le traitement côté
 * admin, et la gestion de la liste de termes elle-même.
 */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `statut` facultatif : par défaut, seuls les signalements encore OUVERT
   * (même logique que DisputesService.listOpen — l'admin veut d'abord voir
   * ce qui reste à traiter, pas tout l'historique).
   */
  listerSignalements(statut?: ShopModerationFlagStatus) {
    return this.prisma.shopModerationFlag.findMany({
      where: statut ? { status: statut } : {},
      include: { shop: { select: { id: true, name: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async resoudreSignalement(flagId: string, outcome: IssueSignalement, note: string | undefined, resolvedByUserId: string) {
    const signalement = await this.prisma.shopModerationFlag.findUnique({ where: { id: flagId } });
    if (!signalement) {
      throw new NotFoundException("Signalement introuvable.");
    }
    if (signalement.status !== ShopModerationFlagStatus.OUVERT) {
      throw new BadRequestException("Ce signalement a déjà été traité.");
    }
    return this.prisma.shopModerationFlag.update({
      where: { id: flagId },
      data: {
        status: outcome === "TRAITE" ? ShopModerationFlagStatus.TRAITE : ShopModerationFlagStatus.IGNORE,
        resolvedAt: new Date(),
        resolvedByUserId,
        resolutionNote: note ?? null,
      },
    });
  }

  listerTermes() {
    return this.prisma.moderationBlockedTerm.findMany({ orderBy: { term: "asc" } });
  }

  async ajouterTerme(term: string) {
    const valeur = term.trim();
    if (!valeur) {
      throw new BadRequestException("Le terme ne peut pas être vide.");
    }
    try {
      await this.prisma.moderationBlockedTerm.create({ data: { term: valeur } });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException(`Le terme "${valeur}" est déjà dans la liste.`);
      }
      throw err;
    }
    return this.listerTermes();
  }

  async supprimerTerme(termId: string) {
    await this.prisma.moderationBlockedTerm.deleteMany({ where: { id: termId } });
    return this.listerTermes();
  }
}
