// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { SynthesePeriode, DossierFinancement } from "./comptable-export.service";

function formaterMontants(cdf: number, usd: number): string {
  const parts: string[] = [];
  if (usd) parts.push(`$${usd.toFixed(2)}`);
  if (cdf) parts.push(`${Math.round(cdf).toLocaleString("fr-FR")} FC`);
  return parts.length ? parts.join(" + ") : "—";
}

function formaterDateHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

/**
 * Synthèse périodique Secourable (prompt §10.5) — même convention de
 * "code de vérification" que les relevés boutique (reports.service.ts) :
 * un repère de cohérence calculé côté serveur, pas une certification
 * comptable/fiscale au sens légal.
 */
export function renderSynthesePdf(synthese: SynthesePeriode): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(14).text("Synthèse ELEGANZ Secourable", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(
    `Période du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(synthese.from))} au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(synthese.to))}`,
    { align: "center" },
  );
  doc.fillColor("#000");
  doc.moveDown(0.8);

  const colonnes = ["Activité", "Ventes", "Dépenses", "Résultat estimé"];
  const largeurs = [largeurPage * 0.34, largeurPage * 0.22, largeurPage * 0.22, largeurPage * 0.22];

  function dessinerLigne(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteur = 20;
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteur).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 5, { width: largeurs[i] - 8, align: i === 0 ? "left" : "right" });
      x += largeurs[i];
    });
    doc.moveTo(margeGauche, yDepart + hauteur).lineTo(margeGauche + largeurPage, yDepart + hauteur).strokeColor("#ccc").stroke();
    doc.strokeColor("#000");
    doc.y = yDepart + hauteur;
  }

  dessinerLigne(colonnes, { gras: true, fond: "#eee" });
  for (const a of synthese.activites) {
    dessinerLigne([
      a.activityName,
      formaterMontants(a.ventesCdf, a.ventesUsd),
      formaterMontants(a.depensesCdf, a.depensesUsd),
      formaterMontants(a.ventesCdf - a.depensesCdf, a.ventesUsd - a.depensesUsd),
    ]);
  }
  dessinerLigne(
    [
      "TOTAL",
      formaterMontants(synthese.totalVentesCdf, synthese.totalVentesUsd),
      formaterMontants(synthese.totalDepensesCdf, synthese.totalDepensesUsd),
      formaterMontants(
        synthese.totalVentesCdf - synthese.totalDepensesCdf,
        synthese.totalVentesUsd - synthese.totalDepensesUsd,
      ),
    ],
    { gras: true, fond: "#eee" },
  );

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Généré le ${formaterDateHeure(synthese.genereLe)} — ${synthese.nombreOperations} opération(s) incluse(s).`);
  doc.text(`Code de vérification : ${synthese.codeVerification}`);
  doc.text(
    "Ce document est calculé à partir de vos saisies déclaratives dans ELEGANZ Secourable. Il ne constitue pas un état financier certifié ni un relevé bancaire officiel.",
  );
  doc.fillColor("#000");

  doc.end();
  return doc;
}

const LABELS_TYPE_DETTE: Record<string, string> = {
  DETTE: "Dette",
  EMPRUNT: "Emprunt",
};

/**
 * Dossier préparatoire pour demande de financement (prompt §15) — conçu
 * pour être joint à une demande de crédit auprès d'une institution de
 * microfinance ou similaire. Le bandeau d'avertissement en tête de
 * document est volontairement visible et répété en pied de page : ce
 * dossier n'est PAS un état financier certifié (prompt §15, décision
 * explicite).
 */
export function renderDossierFinancementPdf(dossier: DossierFinancement): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(16).text("Dossier préparatoire — demande de financement", { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#333").text("ELEGANZ Secourable", { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(0.6);

  // Bandeau d'avertissement — toujours visible, jamais en petit caractère.
  const yBandeau = doc.y;
  doc.rect(margeGauche, yBandeau, largeurPage, 46).fill("#fff3cd");
  doc.fillColor("#664d03").font("Helvetica-Bold").fontSize(9);
  doc.text(
    "Ce document n'est PAS un état financier certifié ni une attestation comptable ou fiscale officielle. " +
      "Il rassemble, à titre préparatoire, les données que vous avez vous-même déclarées dans ELEGANZ Secourable, " +
      "pour appuyer une démarche de financement.",
    margeGauche + 10,
    yBandeau + 7,
    { width: largeurPage - 20 },
  );
  doc.fillColor("#000").font("Helvetica");
  doc.y = yBandeau + 54;

  doc.font("Helvetica-Bold").fontSize(11).text("Porteur du dossier");
  doc.font("Helvetica").fontSize(9).text(dossier.nomUtilisateur);
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").fontSize(11).text("Activités déclarées");
  doc.font("Helvetica").fontSize(9);
  for (const a of dossier.activites) {
    doc.text(
      `• ${a.name} (${a.category.toLowerCase()}) — enregistrée depuis le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(a.creeeLe))}`,
    );
  }
  doc.moveDown(0.6);

  doc.font("Helvetica-Bold").fontSize(11).text(`Historique sur ${dossier.historiqueMensuel.length} mois`);
  doc.moveDown(0.2);

  const colonnes = ["Mois", "Ventes", "Dépenses", "Résultat estimé"];
  const largeurs = [largeurPage * 0.3, largeurPage * 0.23, largeurPage * 0.23, largeurPage * 0.24];
  function dessinerLigne(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteur = 18;
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteur).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 4, { width: largeurs[i] - 8, align: i === 0 ? "left" : "right" });
      x += largeurs[i];
    });
    doc.moveTo(margeGauche, yDepart + hauteur).lineTo(margeGauche + largeurPage, yDepart + hauteur).strokeColor("#ccc").stroke();
    doc.strokeColor("#000");
    doc.y = yDepart + hauteur;
  }
  dessinerLigne(colonnes, { gras: true, fond: "#eee" });
  for (const m of dossier.historiqueMensuel) {
    dessinerLigne([
      m.label,
      formaterMontants(m.ventesCdf, m.ventesUsd),
      formaterMontants(m.depensesCdf, m.depensesUsd),
      formaterMontants(m.ventesCdf - m.depensesCdf, m.ventesUsd - m.depensesUsd),
    ]);
  }

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).text("Dettes et emprunts en cours");
  doc.font("Helvetica").fontSize(9);
  if (dossier.dettesOuvertes.length === 0) {
    doc.text("Aucune dette ni emprunt en cours déclaré.");
  } else {
    for (const d of dossier.dettesOuvertes) {
      doc.text(
        `• ${LABELS_TYPE_DETTE[d.type] ?? d.type} — ${d.counterpartyName} : solde restant ${formaterMontants(
          d.currency === "CDF" ? d.solde : 0,
          d.currency === "USD" ? d.solde : 0,
        )}`,
      );
    }
  }
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").fontSize(11).text("Créances en cours (montants attendus par l'utilisateur)");
  doc.font("Helvetica").fontSize(9);
  if (dossier.creancesOuvertes.length === 0) {
    doc.text("Aucune créance en cours déclarée.");
  } else {
    for (const c of dossier.creancesOuvertes) {
      doc.text(
        `• ${c.counterpartyName} : solde attendu ${formaterMontants(
          c.currency === "CDF" ? c.solde : 0,
          c.currency === "USD" ? c.solde : 0,
        )}`,
      );
    }
  }

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Généré le ${formaterDateHeure(dossier.genereLe)} à partir des données déclarées dans ELEGANZ Secourable.`);
  doc.text(`Code de vérification : ${dossier.codeVerification}`);
  doc.text(
    "Rappel : ce dossier ne remplace pas un état financier certifié, un audit comptable ou une attestation fiscale.",
  );
  doc.fillColor("#000");

  doc.end();
  return doc;
}
