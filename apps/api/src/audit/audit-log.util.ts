import { PrismaService } from "../prisma/prisma.service";

// Piste d'audit interne (18 nov. 2026, chantier "gestion de risque autonome"
// Phase 4, volet retenu par le propriétaire) — câble enfin le modèle
// AuditLog (présent dans schema.prisma depuis l'origine, prompt §41, mais
// jamais utilisé jusqu'ici, confirmé par recherche exhaustive du code).
// Simple fonction plutôt qu'un service injectable : chaque service
// concerné a déjà `this.prisma` (PrismaService), donc aucun câblage de
// module NestJS supplémentaire n'est nécessaire — on appelle juste cette
// fonction avec l'instance déjà disponible. Volontairement minimaliste :
// une traçabilité "qui a fait quoi, quand", jamais une détection
// automatisée de motifs suspects (AML), hors du périmètre retenu.
export async function enregistrerAuditLog(
  prisma: PrismaService,
  params: {
    actorId?: string | null;
    shopId?: string | null;
    action: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      shopId: params.shopId ?? null,
      action: params.action,
      details: (params.details as object | undefined) ?? undefined,
    },
  });
}
