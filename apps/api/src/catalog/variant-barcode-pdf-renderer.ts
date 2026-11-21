// Import CommonJS correct même sans `esModuleInterop` — même remarque que
// pour pdfkit ci-dessous (voir documents/pdf-renderer.ts).
import PDFDocument = require("pdfkit");

// Points par millimètre (1 pt = 1/72 pouce, 1 pouce = 25.4 mm).
const PT_PAR_MM = 72 / 25.4;

export interface DonneesCodeBarreVariantePdf {
  sku: string;
  /** PNG déjà rendu par bwip-js (bcid "code128", includetext: true) — le
   * texte lisible (SKU) est déjà dessiné DANS l'image par bwip-js, jamais
   * redessiné séparément ici. */
  barcodePng: Buffer;
}

/**
 * Format "feuille standard" (21 nov. 2026, demande : "proposer d'imprimer un
 * code barre à partir des infos internes ... qu'on peut coller au produit") —
 * une grille de plusieurs exemplaires du même code-barres sur une page A4,
 * à découper aux ciseaux. Imprimable sur n'importe quelle imprimante de
 * bureau, sans matériel spécifique (contrairement au format étiquette
 * ci-dessous).
 */
export function renderCodeBarreFeuillePdf(donnees: DonneesCodeBarreVariantePdf): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 28 });

  const COLONNES = 3;
  const LIGNES = 7;
  const marge = 28;
  const largeurCellule = (doc.page.width - marge * 2) / COLONNES;
  const hauteurCellule = (doc.page.height - marge * 2) / LIGNES;

  for (let i = 0; i < COLONNES * LIGNES; i++) {
    const col = i % COLONNES;
    const ligne = Math.floor(i / COLONNES);
    const x = marge + col * largeurCellule;
    const y = marge + ligne * hauteurCellule;

    // Pointillés de découpe — purement indicatif, jamais bloquant si le
    // rendu diffère légèrement d'une imprimante à l'autre.
    doc
      .rect(x + 3, y + 3, largeurCellule - 6, hauteurCellule - 6)
      .dash(2, { space: 2 })
      .strokeColor("#aaaaaa")
      .stroke();
    doc.undash();

    const largeurImage = largeurCellule - 16;
    doc.image(donnees.barcodePng, x + 8, y + hauteurCellule / 2 - 14, { width: largeurImage });
  }

  doc.end();
  return doc;
}

/**
 * Format "étiquette dédiée" (même demande) — une seule étiquette par page,
 * dimensionnée pour une imprimante d'étiquettes courante (50×30mm, le format
 * le plus répandu chez les commerçants ELEGANZ). La boutique choisit ce
 * format au moment d'imprimer si elle dispose du matériel adapté ; sinon
 * elle utilise la feuille standard ci-dessus.
 */
export function renderCodeBarreEtiquettePdf(donnees: DonneesCodeBarreVariantePdf): PDFKit.PDFDocument {
  const largeurPt = 50 * PT_PAR_MM;
  const hauteurPt = 30 * PT_PAR_MM;
  const marge = 6;
  const doc = new PDFDocument({ size: [largeurPt, hauteurPt], margin: marge });

  const largeurImage = doc.page.width - marge * 2;
  doc.image(donnees.barcodePng, marge, marge, { width: largeurImage });

  doc.end();
  return doc;
}
