import * as XLSX from "xlsx";

/**
 * Construit un classeur Excel (.xlsx) à une feuille à partir d'en-têtes et de
 * lignes déjà formatées en chaînes/nombres. Utilisé pour tous les exports
 * (boutiques, produits, commandes, factures côté admin et côté boutique) afin
 * de garder un seul endroit qui connaît la mise en forme du fichier.
 */
export function construireClasseurExcel(
  nomFeuille: string,
  entetes: string[],
  lignes: (string | number | null | undefined)[][],
): Buffer {
  const feuille = XLSX.utils.aoa_to_sheet([entetes, ...lignes.map((l) => l.map((v) => v ?? ""))]);
  // Largeur de colonne approximative, calculée sur le contenu le plus long —
  // sans ça, Excel ouvre le fichier avec des colonnes toutes collées.
  const largeurs = entetes.map((entete, i) => {
    const maxContenu = lignes.reduce((max, ligne) => {
      const texte = String(ligne[i] ?? "");
      return Math.max(max, texte.length);
    }, entete.length);
    return { wch: Math.min(40, Math.max(10, maxContenu + 2)) };
  });
  feuille["!cols"] = largeurs;

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, nomFeuille);
  return XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Construit un classeur Excel à PLUSIEURS feuilles (ex. dossier de validation
 * externe SYSCOHADA, chantier réactivé phase 7 — 14 oct. 2026) — même logique
 * de largeur de colonne que `construireClasseurExcel` ci-dessus, appliquée
 * feuille par feuille. Noms de feuille tronqués à 31 caractères (limite du
 * format .xlsx) et dédupliqués si besoin, pour éviter une erreur silencieuse
 * de la librairie en cas de collision.
 */
export function construireClasseurExcelMultiFeuilles(
  feuilles: { nom: string; entetes: string[]; lignes: (string | number | null | undefined)[][] }[],
): Buffer {
  const classeur = XLSX.utils.book_new();
  const nomsUtilises = new Set<string>();

  for (const { nom, entetes, lignes } of feuilles) {
    let nomFinal = nom.slice(0, 31);
    let suffixe = 2;
    while (nomsUtilises.has(nomFinal)) {
      nomFinal = `${nom.slice(0, 28)} ${suffixe}`;
      suffixe++;
    }
    nomsUtilises.add(nomFinal);

    const feuille = XLSX.utils.aoa_to_sheet([entetes, ...lignes.map((l) => l.map((v) => v ?? ""))]);
    const largeurs = entetes.map((entete, i) => {
      const maxContenu = lignes.reduce((max, ligne) => {
        const texte = String(ligne[i] ?? "");
        return Math.max(max, texte.length);
      }, entete.length);
      return { wch: Math.min(60, Math.max(10, maxContenu + 2)) };
    });
    feuille["!cols"] = largeurs;
    XLSX.utils.book_append_sheet(classeur, feuille, nomFinal);
  }

  return XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Lit un classeur Excel envoyé par l'utilisateur et renvoie les lignes de la
 * première feuille sous forme de tableaux de chaînes, la ligne d'en-tête
 * (index 0) incluse. Les lignes entièrement vides sont filtrées.
 */
export function lireClasseurExcel(buffer: Buffer): string[][] {
  const classeur = XLSX.read(buffer, { type: "buffer" });
  const premiereFeuille = classeur.Sheets[classeur.SheetNames[0]];
  if (!premiereFeuille) return [];
  const lignes = XLSX.utils.sheet_to_json<unknown[]>(premiereFeuille, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return lignes.map((ligne) => ligne.map((cellule) => String(cellule ?? "").trim()));
}
