import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Journal d'audit interne (18 nov. 2026, chantier "gestion de risque
 * autonome" Phase 4, volet "piste d'audit interne" retenu par le
 * propriétaire) — lecture seule du modèle AuditLog, écrit par
 * enregistrerAuditLog (voir apps/api/src/audit/audit-log.util.ts) depuis
 * les 8 actions administratives sensibles identifiées (validation
 * d'analyse de crédit, décision de prêt, facture marquée payée, décision
 * de réactivation, suspension/réactivation d'institution ou de refus,
 * suspension/réactivation de compte utilisateur, vérification livreur,
 * changement de statut boutique). Volontairement minimaliste :
 * traçabilité "qui a fait quoi, quand", jamais une détection automatisée
 * de motifs suspects (AML), hors du périmètre retenu.
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(params: { action?: string; actorId?: string; shopId?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const lignes = await this.prisma.auditLog.findMany({
      where: {
        ...(params.action ? { action: params.action } : {}),
        ...(params.actorId ? { actorId: params.actorId } : {}),
        ...(params.shopId ? { shopId: params.shopId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
        shop: { select: { id: true, name: true } },
      },
    });
    const aSuivant = lignes.length > limit;
    const page = aSuivant ? lignes.slice(0, limit) : lignes;
    return {
      lignes: page,
      prochainCurseur: aSuivant ? page[page.length - 1].id : null,
    };
  }

  /** Alimente le filtre "Action" de l'écran — évite de saisir une chaîne à la main. */
  async actionsDistinctes(): Promise<string[]> {
    const lignes = await this.prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });
    return lignes.map((l) => l.action);
  }
}
