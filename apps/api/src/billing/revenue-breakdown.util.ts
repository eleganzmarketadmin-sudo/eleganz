/**
 * Répartition facture / encaissé / en attente / en retard — utilitaire pur
 * partagé (16 nov. 2026, refonte du Centre de pilotage). Extrait de
 * l'ancienne fonction locale `repartir()` de
 * `AdminFinanceService.dashboard()` (apps/api/src/finance/admin-finance.service.ts),
 * puis étendu avec `enAttente`/`enRetard` pour que chaque module de
 * facturation de la plateforme (boutiques, livreurs, Secourable) puisse
 * afficher le même triptyque sur le Centre de pilotage
 * (AdminCockpitService.executiveDashboard) comme sur les rapports de
 * période (AdminFinanceService.dashboard).
 *
 * Pure à dessein (ne lit que les lignes passées en paramètre, jamais une
 * table) — même compromis que dunning.util.ts : testable sans base de
 * données, et réutilisable aussi bien pour une vue « en direct » (pas de
 * borne de dates, l'état actuel de toutes les factures) que pour un
 * rapport daté (lignes déjà filtrées par période par l'appelant).
 *
 * Statuts réellement écrits sur Invoice/DriverInvoice/ComptableInvoice :
 * PENDING | PAID | WAIVED (le commentaire de schéma mentionne aussi OVERDUE
 * mais ce statut n'est jamais écrit — voir echeancier/dunning.util.ts :
 * une facture PENDING dont l'échéance est dépassée est distinguée ici par
 * comparaison de dates, jamais par un statut dédié). WAIVED ne compte ni
 * en encaissé ni en attente/retard — seulement dans le total facturé, pour
 * rester visible sans être compté comme une dette ou un revenu.
 */
export interface LigneFacturable {
  amount: unknown; // Decimal | number | string — toujours reconverti via Number()
  status: string;
  dueAt?: Date | null;
}

export interface RepartitionModule {
  facture: number;
  encaisse: number;
  enAttente: number;
  enRetard: number;
}

export function repartirFacturation(
  lignes: LigneFacturable[],
  maintenant: Date = new Date(),
): RepartitionModule {
  let facture = 0;
  let encaisse = 0;
  let enAttente = 0;
  let enRetard = 0;

  for (const ligne of lignes) {
    const montant = Number(ligne.amount);
    facture += montant;
    if (ligne.status === "PAID") {
      encaisse += montant;
    } else if (ligne.status === "PENDING") {
      if (ligne.dueAt && ligne.dueAt.getTime() < maintenant.getTime()) {
        enRetard += montant;
      } else {
        enAttente += montant;
      }
    }
  }

  return { facture, encaisse, enAttente, enRetard };
}
