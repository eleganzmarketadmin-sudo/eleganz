// Prix de gros par palier de quantité (2 nov. 2026) — logique pure, partagée
// entre tout point qui doit calculer le prix unitaire réellement facturé
// pour une quantité donnée (commande Marketplace aujourd'hui ; dupliquée
// volontairement côté web, dans apps/web/app/lib/price-tiers.ts, pour
// l'affichage avant commande — même convention que formatMoney/money.ts,
// déjà dupliqué entre les deux apps plutôt que partagé via un package
// commun).

export interface PaliersPrix {
  minQuantity: number;
  unitPrice: number;
}

/**
 * Renvoie le prix unitaire à appliquer pour `quantity` unités d'une
 * variante dont le prix normal est `sellPrice`, compte tenu de ses paliers
 * de prix de gros `tiers` (triés ou non — ce n'est pas supposé ici). Le
 * palier retenu est celui au `minQuantity` le plus élevé ne dépassant pas
 * `quantity` ; si aucun palier n'est atteint (ou si la liste est vide),
 * `sellPrice` s'applique sans changement — jamais un prix de gros appliqué
 * à une petite quantité par erreur.
 */
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
