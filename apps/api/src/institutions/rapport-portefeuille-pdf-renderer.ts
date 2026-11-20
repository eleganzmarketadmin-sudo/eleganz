// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import {
  formaterDateHeure,
  formaterMontant,
  dessinerEnTeteIdentite,
  dessinerPiedPageIdentite,
  type IdentitePourPdf,
} from "../finance/dossier-credit-pdf-shared";
import type { RapportPortefeuille } from "./rapport-portefeuille.service";

const LIBELLES_CLASSIFICATION: Record<string, string> = {
  SAIN: "Sain",
  SOUS_SURVEILLANCE: "Sous surveillance",
  DOUTEUX: "Douteux",
  COMPROMIS: "Compromis",
};

function formaterPourcentage(valeur: number | null): string {
  if (valeur === null) return "—";
  return `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/**
 * Export PDF du rapport de portefeuille institution (écran Rapports, 19
 * nov. 2026) — même convention que les autres exports du portail
 * (dossier-credit-pdf-renderer.ts, demande-credit-pdf-renderer.ts) :
 * bandeau d'avertissement rappelant la portée purement informative,
 * jamais une attestation ou une décision ELEGANZ.
 *
 * `identiteInstitution` (20 nov. 2026) remplace l'ancien paramètre
 * `institutionName: string` — voir institution-portal.service.ts pour sa
 * construction (inclut désormais logo/adresse/en-tête/pied de page
 * personnalisés).
 */
export function renderRapportPortefeuillePdf(
  rapport: RapportPortefeuille,
  identiteInstitution: IdentitePourPdf,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  dessinerEnTeteIdentite(doc, identiteInstitution);

  doc.font("Helvetica-Bold").fontSize(16).text("Rapport de portefeuille", { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(0.6);

  const yBandeau = doc.y;
  doc.rect(margeGauche, yBandeau, largeurPage, 46).fill("#fff3cd");
  doc.fillColor("#664d03").font("Helvetica-Bold").fontSize(9);
  doc.text(
    "Vue purement informative de l'encours décaissé via le portail Institutions ELEGANZ. " +
      "ELEGANZ Market reste un facilitateur, jamais une institution financière : ce document ne constitue ni une attestation, ni une décision de risque.",
    margeGauche + 10,
    yBandeau + 7,
    { width: largeurPage - 20 },
  );
  doc.fillColor("#000").font("Helvetica");
  doc.y = yBandeau + 54;

  doc.font("Helvetica-Bold").fontSize(11).text("Vue d'ensemble");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Capital total en cours : ${formaterMontant(rapport.capitalTotalEnCours)}`);
  doc.text(`Provision requise totale : ${formaterMontant(rapport.provisionRequiseTotal)}`);
  doc.text(`Prêts actifs : ${rapport.nombrePretsActifs}`);
  doc.text(`Prêts clôturés : ${rapport.nombrePretsTermines}`);
  doc.text(`Taux de défaut (capital) : ${formaterPourcentage(rapport.tauxDefautCapital)}`);
  doc.text(`Taux de défaut (nombre de prêts) : ${formaterPourcentage(rapport.tauxDefautNombre)}`);
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(11).text("Répartition par classification de risque");
  doc.moveDown(0.3);

  const colonnes = [
    { largeur: 0.34, entete: "Classification" },
    { largeur: 0.2, entete: "Nombre de prêts" },
    { largeur: 0.23, entete: "Solde restant" },
    { largeur: 0.23, entete: "Provision requise" },
  ];
  let x = margeGauche;
  const yEntete = doc.y;
  doc.font("Helvetica-Bold").fontSize(8.5);
  for (const col of colonnes) {
    doc.text(col.entete, x, yEntete, { width: col.largeur * largeurPage });
    x += col.largeur * largeurPage;
  }
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8.5);

  for (const cle of ["SAIN", "SOUS_SURVEILLANCE", "DOUTEUX", "COMPROMIS"] as const) {
    const ligne = rapport.ventilationRisque[cle];
    x = margeGauche;
    const y = doc.y;
    doc.text(LIBELLES_CLASSIFICATION[cle], x, y, { width: colonnes[0].largeur * largeurPage });
    x += colonnes[0].largeur * largeurPage;
    doc.text(String(ligne.nombre), x, y, { width: colonnes[1].largeur * largeurPage });
    x += colonnes[1].largeur * largeurPage;
    doc.text(formaterMontant(ligne.soldeRestant), x, y, { width: colonnes[2].largeur * largeurPage });
    x += colonnes[2].largeur * largeurPage;
    doc.text(formaterMontant(ligne.provisionRequise), x, y, { width: colonnes[3].largeur * largeurPage });
    doc.moveDown(0.6);
  }

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Rapport généré le ${formaterDateHeure(rapport.genereLe)}.`);
  doc.fillColor("#000");

  dessinerPiedPageIdentite(doc, identiteInstitution);

  doc.end();
  return doc;
}
