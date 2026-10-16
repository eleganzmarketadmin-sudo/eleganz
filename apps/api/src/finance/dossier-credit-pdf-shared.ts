// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { DossierCreditBoutiqueBusinessPlan } from "./finance.service";

/**
 * Helpers partagés entre le dossier crédit boutique
 * (dossier-credit-pdf-renderer.ts) et le dossier crédit plateforme
 * (dossier-credit-plateforme-pdf-renderer.ts) — demande du 16 oct. 2026,
 * point 2 : même section "Business plan" (textes + scénarios de prêt +
 * graphique des mensualités) pour les deux niveaux, extraite ici pour ne
 * pas dupliquer le dessin pdfkit.
 */

// `toLocaleString("fr-FR")` sépare les milliers par une espace fine
// insécable (U+202F, pas U+00A0 — vérifié par les codes de caractères)
// qu'Helvetica standard de pdfkit ne sait pas afficher (glyphe de
// remplacement affiché comme "/" — trouvé en testant le rendu du rapport
// annuel, 16 oct. 2026) : remplacée par une espace normale pour un rendu
// PDF correct, sans toucher au formatage Word/PowerPoint (docx/pptxgenjs
// embarquent leurs propres polices, pas de problème là-bas).
export function formaterMontant(montant: number): string {
  return Math.round(montant)
    .toLocaleString("fr-FR")
    .replace(/[  ]/g, " ");
}

export function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
}

export function formaterDateHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

export function dessinerSectionBusinessPlan(
  doc: PDFKit.PDFDocument,
  margeGauche: number,
  largeurPage: number,
  bp: DossierCreditBoutiqueBusinessPlan,
) {
  const aDuContenu =
    bp.resumeExecutif || bp.descriptionActivite || bp.marcheEtClientele || bp.strategieCroissance || bp.utilisationFonds || bp.risquesMitigation || bp.scenarios.length > 0;
  if (!aDuContenu) return;

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(14).text("Business plan");
  doc.moveDown(0.4);

  function section(titre: string, contenu: string | null) {
    if (!contenu) return;
    doc.font("Helvetica-Bold").fontSize(10).text(titre);
    doc.font("Helvetica").fontSize(9).text(contenu, { width: largeurPage });
    doc.moveDown(0.5);
  }
  section("Résumé exécutif", bp.resumeExecutif);
  section("Description de l'activité", bp.descriptionActivite);
  section("Marché et clientèle", bp.marcheEtClientele);
  section("Stratégie de croissance", bp.strategieCroissance);
  section("Utilisation des fonds sollicités", bp.utilisationFonds);
  section("Risques et mitigation", bp.risquesMitigation);

  if (bp.scenarios.length === 0) return;

  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11).text("Scénarios de sollicitation de prêt");
  doc.moveDown(0.2);

  const colonnesScenario = ["Scénario", "Montant", "Taux annuel", "Durée", "Mensualité", "Objet"];
  const largeursScenario = [
    largeurPage * 0.18,
    largeurPage * 0.14,
    largeurPage * 0.12,
    largeurPage * 0.1,
    largeurPage * 0.14,
    largeurPage * 0.32,
  ];
  function ligneScenario(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteur = 20;
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteur).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(7.5);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 5, { width: largeursScenario[i] - 8, align: i === 0 || i === 5 ? "left" : "right" });
      x += largeursScenario[i];
    });
    doc.moveTo(margeGauche, yDepart + hauteur).lineTo(margeGauche + largeurPage, yDepart + hauteur).strokeColor("#ccc").stroke();
    doc.strokeColor("#000");
    doc.y = yDepart + hauteur;
  }
  ligneScenario(colonnesScenario, { gras: true, fond: "#eee" });
  for (const s of bp.scenarios) {
    ligneScenario([
      s.label,
      formaterMontant(s.montant),
      `${s.tauxAnnuel.toLocaleString("fr-FR")} %`,
      `${s.dureeMois} mois`,
      formaterMontant(s.mensualite),
      s.objetFinancement ?? "—",
    ]);
  }

  // Graphique vectoriel (barres) comparant la mensualité de chaque scénario
  // — pas de dépendance d'image/canvas, dessiné à la main avec les
  // primitives pdfkit (décision 16 oct. 2026 : pas de canvas natif, risque
  // de compilation sur Railway).
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(10).text("Comparaison des mensualités");
  doc.moveDown(0.2);
  const hauteurGraphe = 90;
  const yGraphe = doc.y;
  const maxMensualite = Math.max(...bp.scenarios.map((s) => s.mensualite), 1);
  const largeurBarre = Math.min(60, (largeurPage - 20) / bp.scenarios.length - 12);
  let xBarre = margeGauche + 10;
  doc.font("Helvetica").fontSize(7);
  for (const s of bp.scenarios) {
    const h = Math.max(2, (s.mensualite / maxMensualite) * (hauteurGraphe - 20));
    doc.rect(xBarre, yGraphe + (hauteurGraphe - 20) - h, largeurBarre, h).fill("#9333ea");
    doc.fillColor("#000").text(formaterMontant(s.mensualite), xBarre - 6, yGraphe + (hauteurGraphe - 20) - h - 10, {
      width: largeurBarre + 12,
      align: "center",
    });
    doc.text(s.label, xBarre - 6, yGraphe + hauteurGraphe - 18, { width: largeurBarre + 12, align: "center" });
    xBarre += largeurBarre + 12;
  }
  doc.y = yGraphe + hauteurGraphe;
  doc.fillColor("#000");
}
