// Prix de gros par palier de quantité (2 nov. 2026) — copie côté web de la
// même logique pure que apps/api/src/common/pricing.util.ts (même
// convention que money.ts, déjà dupliqué entre les deux apps plutôt que
// partagé via un package commun). Sert uniquement à l'AFFICHAGE avant
// commande (panier, fiche produit) — le prix réellement facturé est, comme
// toujours, recalculé côté serveur à la création de la commande.

export interface PaliersPrix {
  minQuantity: number;
  unitPrice: number;
}

export function prixUnitaireEffectif(quantity: number, sellPrice: number, tiers: PaliersPrix[] | undefined | null): number {
  if (!tiers || tiers.length === 0) return sellPrice;
  let meilleur: PaliersPrix | null = null;
  for (const palier of tiers) {
    if (palier.minQuantity <= quantity && (meilleur === null || palier.minQuantity > meilleur.minQuantity)) {
      meilleur = palier;
    }
  }
  return meilleur ? meilleur.unitPrice : sellPrice;
}
