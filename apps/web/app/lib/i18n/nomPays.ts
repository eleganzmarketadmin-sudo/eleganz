/**
 * Nom traduit d'un pays de référence (zones de livraison, 15 oct. 2026) —
 * clé `pays_<isoCode>` dans translations.ts, avec repli sur le nom
 * canonique renvoyé par l'API (`pays.name`, en français) si cette clé
 * n'existe pas encore pour ce pays (ex. un pays ajouté plus tard, avant que
 * sa traduction ne soit ajoutée dans les 9 langues).
 */
export function nomPays(t: (cle: string) => string, pays: { isoCode: string; name: string }): string {
  const cle = `pays_${pays.isoCode}`;
  const traduit = t(cle);
  return traduit === cle ? pays.name : traduit;
}
