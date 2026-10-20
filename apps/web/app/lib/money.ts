/**
 * Formatage des montants. Les boutiques ELEGANZ facturent en USD ou en CDF
 * (champ `currency` sur chaque vente/variante) — jamais une devise par
 * défaut implicite côté écran.
 *
 * On n'utilise pas Intl.NumberFormat("fr-CD", ...) : les runtimes Node en
 * "small-icu" n'embarquent pas les données de la locale fr-CD, ce qui ferait
 * planter le formatage en production sans qu'on s'en aperçoive ici. Le
 * regroupement par milliers est donc fait à la main — stable partout.
 */
export function formatMoney(amount: number, currency: string = "USD"): string {
  const entier = Math.round(amount * 100) / 100;
  const negatif = entier < 0;
  const [partieEntiere, partieDecimale] = Math.abs(entier).toFixed(2).split(".");
  const groupes: string[] = [];
  for (let i = partieEntiere.length; i > 0; i -= 3) {
    groupes.unshift(partieEntiere.slice(Math.max(0, i - 3), i));
  }
  const corps = groupes.join(" ");
  const signe = negatif ? "-" : "";

  if (currency === "CDF") {
    // Le franc congolais ne s'affiche pas avec des décimales à l'usage.
    return `${signe}${corps} FC`;
  }
  return `${signe}$${corps}.${partieDecimale}`;
}

/**
 * Mécanisme de promotion (19 oct. 2026) : une promotion est active
 * uniquement si compareAtPrice est renseigné ET strictement supérieur au
 * prix de vente réel — même règle que côté API (catalog.service.ts),
 * jamais un badge "promo" affiché sur la seule base d'un champ présent.
 */
export function pourcentageRemise(sellPrice: number, compareAtPrice?: number | string | null): number | null {
  if (compareAtPrice == null) return null;
  const reference = Number(compareAtPrice);
  if (!Number.isFinite(reference) || reference <= sellPrice) return null;
  return Math.round(((reference - sellPrice) / reference) * 100);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatHeure(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
