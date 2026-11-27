// Import CommonJS correct même sans `esModuleInterop` (même remarque que
// pour reports/report-pdf-renderer.ts — voir ce fichier pour l'explication
// complète du contournement).
import PDFDocument = require("pdfkit");

export interface LigneStockExport {
  produitNom: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockQty: number;
  cump: number | null;
  valeurStock: number;
  lowStockAt: number;
}

function f(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/**
 * Export PDF de l'écran Stock & CMV (27 nov. 2026, demande : "possibilité
 * d'exporter en Excel ou pdf") — même gabarit tabulaire A4 que
 * reports/report-pdf-renderer.ts (relevé d'activité), un fichier dédié par
 * type de document plutôt qu'un rendu de table générique partagé, comme les
 * autres renderers PDF de ce module.
 */
export function renderStockPdf(lignes: LigneStockExport[], titreBoutique: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const margeDroite = doc.page.margins.right;
  const largeurPage = doc.page.width - margeGauche - margeDroite;
  const basDePage = doc.page.height - doc.page.margins.bottom;

  doc.font("Helvetica-Bold").fontSize(14).text("Stock & CMV", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(titreBoutique, { align: "center" });
  doc.text(
    `Généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date())}`,
    { align: "center" },
  );
  doc.fillColor("#000");
  doc.moveDown(0.8);

  const colonnes = ["Article", "Variante", "Stock", "CUMP", "Valeur stock", "Seuil"];
  const largeurs = [
    largeurPage * 0.28,
    largeurPage * 0.28,
    largeurPage * 0.11,
    largeurPage * 0.11,
    largeurPage * 0.14,
    largeurPage * 0.08,
  ];

  function dessinerLigne(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteurLigne = 18;
    if (doc.y + hauteurLigne > basDePage) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteurLigne).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(7.5);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 4, { width: largeurs[i] - 8, align: i >= 2 ? "right" : "left" });
      x += largeurs[i];
    });
    doc
      .moveTo(margeGauche, yDepart + hauteurLigne)
      .lineTo(margeGauche + largeurPage, yDepart + hauteurLigne)
      .strokeColor("#ccc")
      .stroke();
    doc.strokeColor("#000");
    doc.y = yDepart + hauteurLigne;
  }

  dessinerLigne(colonnes, { gras: true, fond: "#eee" });

  let valeurTotale = 0;
  for (const l of lignes) {
    valeurTotale += l.valeurStock;
    const variante = [l.sku, l.size, l.color].filter(Boolean).join(" · ");
    dessinerLigne([
      l.produitNom,
      variante,
      String(l.stockQty),
      l.cump != null ? `${f(l.cump)} $` : "—",
      `${f(l.valeurStock)} $`,
      String(l.lowStockAt),
    ]);
  }

  dessinerLigne(["TOTAL", "", "", "", `${f(valeurTotale)} $`, ""], { gras: true, fond: "#eee" });

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`${lignes.length} variante(s) incluse(s) dans cet export.`);
  doc.fillColor("#000");

  doc.end();
  return doc;
}
