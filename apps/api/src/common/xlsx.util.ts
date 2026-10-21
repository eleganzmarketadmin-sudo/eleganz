import ExcelJS from "exceljs";

// 21 oct. 2026 (audit sécurité) : remplace `xlsx` (SheetJS) par `exceljs` —
// `xlsx@0.18.5` porte deux failles hautes (pollution de prototype, ReDoS)
// sans correctif disponible sur le canal npm gratuit (le mainteneur ne
// publie ses patches que sur son propre CDN/offre payante). `exceljs` est
// activement maintenu et n'a, à ce jour, aucune vulnérabilité connue.
// Changement d'API notable : exceljs lit/écrit de façon asynchrone (il n'y a
// pas d'équivalent synchrone), donc les trois fonctions ci-dessous sont
// désormais `async` — chaque appelant a été mis à jour pour les `await`.

function appliquerLargeursColonnes(
  feuille: ExcelJS.Worksheet,
  entetes: string[],
  lignes: (string | number | null | undefined)[][],
  largeurMax: number,
) {
  feuille.columns = entetes.map((entete, i) => {
    const maxContenu = lignes.reduce((max, ligne) => {
      const texte = String(ligne[i] ?? "");
      return Math.max(max, texte.length);
    }, entete.length);
    return { width: Math.min(largeurMax, Math.max(10, maxContenu + 2)) };
  });
}

/**
 * Construit un classeur Excel (.xlsx) à une feuille à partir d'en-têtes et de
 * lignes déjà formatées en chaînes/nombres. Utilisé pour tous les exports
 * (boutiques, produits, commandes, factures côté admin et côté boutique) afin
 * de garder un seul endroit qui connaît la mise en forme du fichier.
 */
export async function construireClasseurExcel(
  nomFeuille: string,
  entetes: string[],
  lignes: (string | number | null | undefined)[][],
): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet(nomFeuille);
  feuille.addRow(entetes);
  for (const ligne of lignes) {
    feuille.addRow(ligne.map((v) => v ?? ""));
  }
  // Largeur de colonne approximative, calculée sur le contenu le plus long —
  // sans ça, Excel ouvre le fichier avec des colonnes toutes collées.
  appliquerLargeursColonnes(feuille, entetes, lignes, 40);

  const buffer = await classeur.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface Feuille {
  nom: string;
  entetes: string[];
  lignes: (string | number | null | undefined)[][];
}

/**
 * Construit un classeur Excel à PLUSIEURS feuilles (ex. dossier de validation
 * externe SYSCOHADA, chantier réactivé phase 7 — 14 oct. 2026) — même logique
 * de largeur de colonne que `construireClasseurExcel` ci-dessus, appliquée
 * feuille par feuille. Noms de feuille tronqués à 31 caractères (limite du
 * format .xlsx) et dédupliqués si besoin, pour éviter une erreur silencieuse
 * de la librairie en cas de collision.
 */
export async function construireClasseurExcelMultiFeuilles(feuilles: Feuille[]): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const nomsUtilises = new Set<string>();

  for (const { nom, entetes, lignes } of feuilles) {
    let nomFinal = nom.slice(0, 31);
    let suffixe = 2;
    while (nomsUtilises.has(nomFinal)) {
      nomFinal = `${nom.slice(0, 28)} ${suffixe}`;
      suffixe++;
    }
    nomsUtilises.add(nomFinal);

    const feuille = classeur.addWorksheet(nomFinal);
    feuille.addRow(entetes);
    for (const ligne of lignes) {
      feuille.addRow(ligne.map((v) => v ?? ""));
    }
    appliquerLargeursColonnes(feuille, entetes, lignes, 60);
  }

  const buffer = await classeur.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Lit un classeur Excel envoyé par l'utilisateur et renvoie les lignes de la
 * première feuille sous forme de tableaux de chaînes, la ligne d'en-tête
 * (index 0) incluse. Les lignes entièrement vides sont filtrées.
 */
export async function lireClasseurExcel(buffer: Buffer): Promise<string[][]> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(buffer);
  const premiereFeuille = classeur.worksheets[0];
  if (!premiereFeuille) return [];

  const lignes: string[][] = [];
  premiereFeuille.eachRow({ includeEmpty: false }, (row) => {
    // `row.values` est 1-indexé par exceljs (index 0 toujours vide) — on
    // reconstruit un tableau 0-indexé sur la largeur réelle de la ligne,
    // en couvrant les cellules sautées (valeur vide) comme SheetJS le
    // faisait avec `defval: ""`.
    const valeurs: string[] = [];
    for (let i = 1; i <= row.cellCount; i++) {
      const cellule = row.getCell(i);
      valeurs.push(String(cellule.value ?? "").trim());
    }
    if (valeurs.some((v) => v !== "")) {
      lignes.push(valeurs);
    }
  });
  return lignes;
}
