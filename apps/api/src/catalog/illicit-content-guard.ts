/**
 * Détection de contenu illicite dans la saisie d'un article (24 nov. 2026,
 * retour propriétaire : "mettre en place le controle de saisie ... pour
 * eviter de devenir une plateforme de blanchiment des capitaux et de vente
 * des produits illicites ... dans toutes les langues ... ne pas permettre de
 * créer de tels produits et signaler la boutique à l'administration").
 *
 * Simple recherche de termes (liste tenue dans ModerationBlockedTerm, voir
 * schema.prisma) dans le texte saisi, insensible à la casse et aux accents,
 * avec des limites de mot pour éviter qu'un terme court corresponde à
 * l'intérieur d'un mot plus long sans rapport (ex. "arme" ne doit pas
 * correspondre à "armoire", ni "cannabis" à l'intérieur d'un mot composé
 * inconnu). `\p{L}`/`\p{N}` (plutôt que `\w`, qui ne couvre que l'alphabet
 * latin de base) pour que la limite de mot fonctionne aussi en arabe et
 * dans les autres scripts non-latins pris en charge par la plateforme.
 *
 * Volontairement une simple correspondance de texte, jamais une analyse
 * sémantique : un faux positif reste possible (ex. un article "chanvre" à
 * usage cosmétique légitime) — c'est justement pourquoi l'appelant bloque
 * la création ET signale la boutique à l'admin pour arbitrage humain,
 * jamais une suspension automatique décidée par ce seul mécanisme.
 */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function echapperRegExp(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renvoie le terme interdit (tel qu'enregistré, pas normalisé) trouvé dans
 * l'un des textes fournis, ou `null` si aucun ne correspond. `textes` peut
 * contenir des valeurs vides/nulles (champs facultatifs non renseignés) —
 * elles sont simplement ignorées.
 */
export function trouverTermeInterdit(
  textes: Array<string | null | undefined>,
  termesInterdits: string[],
): string | null {
  const cible = normaliser(textes.filter((t): t is string => !!t && t.trim() !== "").join(" \n "));
  if (!cible) return null;

  for (const terme of termesInterdits) {
    const termeNormalise = normaliser(terme).trim();
    if (!termeNormalise) continue;
    const motif = new RegExp(`(?<![\\p{L}\\p{N}])${echapperRegExp(termeNormalise)}(?![\\p{L}\\p{N}])`, "u");
    if (motif.test(cible)) return terme;
  }
  return null;
}
