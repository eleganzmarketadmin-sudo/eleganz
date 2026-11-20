/**
 * Récupère une image (logo) depuis son URL publique pour l'imprimer dans un
 * PDF généré côté serveur — jamais bloquant : URL absente, serveur distant
 * indisponible, fichier trop volumineux ou délai dépassé retournent
 * simplement `null` plutôt que de faire échouer tout le document.
 *
 * Copie volontaire de `DocumentsService.recupererLogo` (apps/api/src/
 * documents/documents.service.ts) plutôt qu'un partage direct : ce service
 * est propre au module Documents (factures/tickets boutique) et les
 * renderers du portail Institutions (dossier-credit-pdf-shared.ts) n'ont
 * aucune raison de dépendre de DocumentsModule pour une fonction aussi
 * simple et sans état.
 */
export async function recupererLogoDepuisUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 4000);
    const reponse = await fetch(url, { signal: controleur.signal });
    clearTimeout(minuteur);
    if (!reponse.ok) return null;
    const tailleDeclaree = Number(reponse.headers.get("content-length") ?? "0");
    if (tailleDeclaree > 3_000_000) return null; // garde-fou : 3 Mo max
    const tampon = Buffer.from(await reponse.arrayBuffer());
    if (tampon.byteLength > 3_000_000) return null;
    return tampon;
  } catch {
    return null;
  }
}
