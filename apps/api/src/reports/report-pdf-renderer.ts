// Import CommonJS correct même sans `esModuleInterop` (même remarque que
// pour documents/pdf-renderer.ts — voir ce fichier pour l'explication
// complète du contournement).
import PDFDocument = require("pdfkit");
import type { ReleveActivite } from "./reports.service";

const LABELS_REGROUPEMENT: Record<string, string> = {
  PRODUIT: "Produit",
  CATEGORIE: "Catégorie",
  MOYEN_PAIEMENT: "Moyen de paiement",
  BOUTIQUE: "Boutique",
};

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
}

function formaterMontants(montantUSD: number, montantCDF: number): string {
  const parts: string[] = [];
  if (montantUSD) parts.push(`$${montantUSD.toFixed(2)}`);
  if (montantCDF) parts.push(`${Math.round(montantCDF).toLocaleString("fr-FR")} FC`);
  return parts.length ? parts.join(" + ") : "—";
}

/**
 * Relevé d'activité au format tabulaire (A4), distinct du ticket de caisse
 * (documents/pdf-renderer.ts, format 80mm) — demande du 12 oct. 2026.
 * "Certifié" : porte le code de vérification calculé côté serveur
 * (reports.service.ts) et la date de génération, jamais modifiable depuis
 * l'écran qui l'affiche.
 */
export function renderReleveActivitePdf(releve: ReleveActivite, titreBoutique: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const margeDroite = doc.page.margins.right;
  const largeurPage = doc.page.width - margeGauche - margeDroite;
  const basDePage = doc.page.height - doc.page.margins.bottom;

  doc.font("Helvetica-Bold").fontSize(14).text("Relevé d'activité ELEGANZ", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(titreBoutique, { align: "center" });
  doc.text(`Période du ${formaterDate(releve.from)} au ${formaterDate(releve.to)}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(0.8);

  const libelleRegroupement = releve.regroupement
    ? LABELS_REGROUPEMENT[releve.regroupement]
    : "Total";
  const colonnes = [libelleRegroupement, ...releve.periodes.map((p) => p.label), "Total"];
  const largeurPremiere = Math.min(160, largeurPage * 0.3);
  const largeurAutres = (largeurPage - largeurPremiere) / Math.max(1, colonnes.length - 1);
  const largeurs = [largeurPremiere, ...Array(colonnes.length - 1).fill(largeurAutres)];

  function dessinerLigne(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteurLigne = 20;
    if (doc.y + hauteurLigne > basDePage) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteurLigne).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 5, { width: largeurs[i] - 8, align: i === 0 ? "left" : "right" });
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

  for (const groupe of releve.groupes) {
    const ligne = releve.periodes.map((p) => {
      const c = releve.cellules[groupe][p.cle];
      return formaterMontants(c.montantUSD, c.montantCDF);
    });
    const totalGroupe = releve.totauxParGroupe[groupe];
    dessinerLigne([groupe, ...ligne, formaterMontants(totalGroupe.montantUSD, totalGroupe.montantCDF)]);
  }

  const totalParPeriode = releve.periodes.map((p) => {
    const t = releve.totauxParPeriode[p.cle];
    return formaterMontants(t.montantUSD, t.montantCDF);
  });
  dessinerLigne(
    ["TOTAL GÉNÉRAL", ...totalParPeriode, formaterMontants(releve.totalGeneral.montantUSD, releve.totalGeneral.montantCDF)],
    { gras: true, fond: "#eee" },
  );

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(
    `Relevé certifié par la plateforme ELEGANZ — généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(releve.genereLe))}.`,
  );
  doc.text(`Code de vérification : ${releve.codeCertification}`);
  doc.text(
    `${releve.totalGeneral.ventesCount} vente(s)/commande(s) distincte(s) incluse(s) dans ce relevé.`,
  );
  doc.fillColor("#000");

  doc.end();
  return doc;
}
