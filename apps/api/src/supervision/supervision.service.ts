import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@eleganz/database";

const STATUTS_TERMINAUX: OrderStatus[] = [OrderStatus.CLOSED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
// Litige ou retour en cours : signalé à l'admin indépendamment du temps
// écoulé, ce n'est jamais "normal" d'y rester longtemps.
const STATUTS_ATTENTION_IMMEDIATE: OrderStatus[] = [OrderStatus.DISPUTED, OrderStatus.RETURN_REQUESTED];

/**
 * Seuils indicatifs (en heures) avant qu'une commande restée dans une étape
 * soit signalée en retard — des repères de supervision raisonnables pour le
 * contexte RDC (réseau, délais de livraison en ville), pas un engagement
 * contractuel envers l'acheteur. Ajustables plus tard si l'expérience réelle
 * le justifie ; aucun statut absent de cette carte n'est jamais signalé en
 * retard (ex. RECEIVED_CONFIRMED, qui n'attend plus que la boutique clôture).
 */
const SEUILS_HEURES: Partial<Record<OrderStatus, number>> = {
  [OrderStatus.CREATED]: 24,
  [OrderStatus.PAYMENT_PENDING]: 24,
  [OrderStatus.PAYMENT_CONFIRMED]: 12,
  [OrderStatus.ACCEPTED]: 48,
  [OrderStatus.PREPARING]: 48,
  [OrderStatus.READY_FOR_PICKUP]: 24,
  [OrderStatus.PICKED_UP]: 6,
  [OrderStatus.IN_TRANSIT]: 48,
  [OrderStatus.DELIVERED_DECLARED]: 72,
};

export const LABELS_STATUT_COMMANDE: Record<string, string> = {
  CREATED: "Créée",
  PAYMENT_PENDING: "Paiement en attente",
  PAYMENT_CONFIRMED: "Paiement confirmé",
  ACCEPTED: "Acceptée",
  PREPARING: "En préparation",
  READY_FOR_PICKUP: "Prête pour enlèvement",
  PICKED_UP: "Enlevée",
  IN_TRANSIT: "En livraison",
  DELIVERED_DECLARED: "Livraison déclarée",
  RECEIVED_CONFIRMED: "Réception confirmée",
  RETURN_REQUESTED: "Retour demandé",
  DISPUTED: "En litige",
  CLOSED: "Clôturée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

/**
 * Supervision des commandes/paiements pour le Centre de pilotage (demande du
 * 12 oct. 2026, point 4) : un suivi en direct des commandes actives avec
 * repère de retard (SLA indicatif), et des statistiques de comportement par
 * boutique et par livreur — pour repérer un acteur systématiquement lent ou
 * en litige, pas seulement une commande isolée en retard.
 */
@Injectable()
export class SupervisionService {
  constructor(private readonly prisma: PrismaService) {}

  async commandesEnCours(shopId?: string) {
    const commandes = await this.prisma.shopOrder.findMany({
      where: {
        status: { notIn: STATUTS_TERMINAUX },
        ...(shopId ? { shopId } : {}),
      },
      include: {
        shop: { select: { name: true } },
        driver: { select: { user: { select: { fullName: true } } } },
        order: { select: { buyer: { select: { fullName: true } } } },
      },
      orderBy: { updatedAt: "asc" },
    });

    const maintenant = Date.now();
    const lignes = commandes.map((c) => {
      const heuresDansStatut = (maintenant - c.updatedAt.getTime()) / 3_600_000;
      const seuil = SEUILS_HEURES[c.status];
      const attentionImmediate = STATUTS_ATTENTION_IMMEDIATE.includes(c.status);
      const enRetard = attentionImmediate || (seuil !== undefined && heuresDansStatut > seuil);
      return {
        id: c.id,
        boutique: c.shop.name,
        acheteur: c.order.buyer.fullName,
        statut: c.status,
        statutLabel: LABELS_STATUT_COMMANDE[c.status] ?? c.status,
        livreur: c.driver?.user.fullName ?? null,
        creeLe: c.createdAt.toISOString(),
        depuisLe: c.updatedAt.toISOString(),
        heuresDansStatut: Math.round(heuresDansStatut * 10) / 10,
        seuilHeures: seuil ?? null,
        enRetard,
        attentionImmediate,
      };
    });

    return lignes.sort(
      (a, b) => Number(b.enRetard) - Number(a.enRetard) || b.heuresDansStatut - a.heuresDansStatut,
    );
  }

  /**
   * Délai moyen entre deux événements de statut, calculé uniquement sur les
   * commandes où les deux événements ont réellement été enregistrés — donc
   * `null` tant qu'aucune commande n'a parcouru ce trajet depuis le
   * déploiement de l'historique (OrderStatusEvent, 12 oct. 2026).
   */
  private delaiMoyenHeures(
    commandes: { statusEvents: { status: OrderStatus; occurredAt: Date }[] }[],
    depuis: OrderStatus,
    vers: OrderStatus,
  ): number | null {
    const delais: number[] = [];
    for (const c of commandes) {
      const debut = c.statusEvents.find((e) => e.status === depuis);
      const fin = c.statusEvents.find((e) => e.status === vers);
      if (debut && fin) delais.push((fin.occurredAt.getTime() - debut.occurredAt.getTime()) / 3_600_000);
    }
    if (!delais.length) return null;
    return Math.round((delais.reduce((s, v) => s + v, 0) / delais.length) * 10) / 10;
  }

  async comportementBoutiques() {
    const boutiques = await this.prisma.shop.findMany({
      select: {
        id: true,
        name: true,
        orders: {
          select: {
            status: true,
            dispute: { select: { id: true } },
            statusEvents: { select: { status: true, occurredAt: true } },
          },
        },
      },
    });

    return boutiques
      .filter((b) => b.orders.length > 0)
      .map((b) => {
        const total = b.orders.length;
        const annulees = b.orders.filter((o) => o.status === OrderStatus.CANCELLED).length;
        const litiges = b.orders.filter((o) => o.dispute).length;
        return {
          boutiqueId: b.id,
          boutique: b.name,
          totalCommandes: total,
          tauxAnnulationPct: Math.round((annulees / total) * 1000) / 10,
          tauxLitigePct: Math.round((litiges / total) * 1000) / 10,
          delaiMoyenAcceptationHeures: this.delaiMoyenHeures(
            b.orders,
            OrderStatus.CREATED,
            OrderStatus.ACCEPTED,
          ),
        };
      })
      .sort((a, b) => b.totalCommandes - a.totalCommandes);
  }

  async comportementLivreurs() {
    const livreurs = await this.prisma.driver.findMany({
      select: {
        id: true,
        verified: true,
        user: { select: { fullName: true } },
        deliveries: {
          select: {
            status: true,
            dispute: { select: { id: true } },
            statusEvents: { select: { status: true, occurredAt: true } },
          },
        },
      },
    });

    const STATUTS_LIVRES: OrderStatus[] = [
      OrderStatus.DELIVERED_DECLARED,
      OrderStatus.RECEIVED_CONFIRMED,
      OrderStatus.CLOSED,
    ];

    return livreurs
      .filter((l) => l.deliveries.length > 0)
      .map((l) => {
        const total = l.deliveries.length;
        const livrees = l.deliveries.filter((d) => STATUTS_LIVRES.includes(d.status)).length;
        const litiges = l.deliveries.filter((d) => d.dispute).length;
        return {
          livreurId: l.id,
          nom: l.user.fullName,
          verifie: l.verified,
          totalLivraisons: total,
          livrees,
          tauxLitigePct: Math.round((litiges / total) * 1000) / 10,
          delaiMoyenLivraisonHeures: this.delaiMoyenHeures(
            l.deliveries,
            OrderStatus.PICKED_UP,
            OrderStatus.DELIVERED_DECLARED,
          ),
        };
      })
      .sort((a, b) => b.totalLivraisons - a.totalLivraisons);
  }
}
