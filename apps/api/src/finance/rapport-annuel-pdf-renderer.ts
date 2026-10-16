// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { RapportAnnuelDonnees } from "./rapport-annuel.service";
import { formaterMontant, formaterDateHeure } from "./dossier-credit-pdf-shared";

function formaterPct(valeur: number | null): string {
  return valeur === null ? "—" : `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/**
 * Rapport annuel — PDF (demande du 16 oct. 2026, point 3) — aux normes
 * SYSCOHADA/OHADA déjà utilisées pour la comptabilité ELEGANZ. Graphiques
 * en barres vectorielles dessinées à la main (pdfkit), jamais de rainbow
 * pie ni de dépendance canvas/image (décision du 16 oct. 2026, même raison
 * que le dossier crédit : risque de compilation native sur Railway).
 */
export function renderRapportAnnuelPdf(rapport: RapportAnnuelDonnees): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  function pied() {
    const y = doc.page.height - doc.page.margins.bottom + 10;
    doc.font("Helvetica").fontSize(7).fillColor("#888");
    doc.text(`Rapport annuel ${rapport.annee} — ${rapport.entiteNom} — Code ${rapport.codeVerification}`, margeGauche, y, {
      width: largeurPage,
      align: "center",
    });
    doc.fillColor("#000");
  }

  // Page de couverture.
  doc.font("Helvetica-Bold").fontSize(26).text("Rapport annuel", { align: "center" });
  doc.font("Helvetica-Bold").fontSize(40).fillColor("#9333ea").text(String(rapport.annee), { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(16).text(rapport.entiteNom, { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#555");
  if (rapport.identiteFiscale.fiscalLegalName) doc.text(rapport.identiteFiscale.fiscalLegalName, { align: "center" });
  if (rapport.identiteFiscale.fiscalAddress) doc.text(rapport.identiteFiscale.fiscalAddress, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(2);
  doc.font("Helvetica").fontSize(8).fillColor("#888").text(`Généré le ${formaterDateHeure(rapport.genereLe)}`, { align: "center" });
  doc.text("Préparé selon les normes comptables SYSCOHADA/OHADA — non audité par un expert-comptable externe.", {
    align: "center",
  });
  doc.fillColor("#000");
  pied();

  // Chiffres clés.
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).text("Chiffres clés de l'exercice");
  doc.moveDown(0.6);
  const tuiles = [
    { label: "Chiffre d'affaires", valeur: formaterMontant(rapport.chiffresCles.chiffreAffaires) },
    { label: "Charges", valeur: formaterMontant(rapport.chiffresCles.charges) },
    { label: "Résultat net (avant impôt)", valeur: formaterMontant(rapport.chiffresCles.resultatNet) },
    { label: "Marge nette", valeur: formaterPct(rapport.chiffresCles.margeNette) },
    { label: "Croissance du CA vs année précédente", valeur: formaterPct(rapport.chiffresCles.croissanceCA) },
  ];
  const largeurTuile = (largeurPage - 20) / 2;
  let xTuile = margeGauche;
  let yLigneTuile = doc.y;
  tuiles.forEach((tu, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) yLigneTuile = doc.y;
    xTuile = margeGauche + col * (largeurTuile + 20);
    doc.rect(xTuile, yLigneTuile, largeurTuile, 50).fillAndStroke("#f5f3ff", "#9333ea");
    doc.fillColor("#555").font("Helvetica").fontSize(8).text(tu.label, xTuile + 10, yLigneTuile + 8, { width: largeurTuile - 20 });
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(14).text(tu.valeur, xTuile + 10, yLigneTuile + 24, { width: largeurTuile - 20 });
    if (col === 1 || i === tuiles.length - 1) doc.y = yLigneTuile + 60;
  });
  pied();

  // Évolution mensuelle — graphique en barres (CA vs charges) + table.
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).text("Évolution mensuelle");
  doc.moveDown(0.4);

  const hauteurGraphe = 160;
  const yGraphe = doc.y;
  const maxValeur = Math.max(
    ...rapport.evolutionMensuelle.map((m) => Math.max(m.chiffreAffaires, m.charges)),
    1,
  );
  const largeurGroupe = (largeurPage - 10) / rapport.evolutionMensuelle.length;
  const largeurBarre = Math.min(10, largeurGroupe / 2 - 2);
  let xGroupe = margeGauche;
  doc.font("Helvetica").fontSize(6);
  for (const m of rapport.evolutionMensuelle) {
    const hCa = Math.max(1, (m.chiffreAffaires / maxValeur) * (hauteurGraphe - 20));
    const hCh = Math.max(1, (m.charges / maxValeur) * (hauteurGraphe - 20));
    doc.rect(xGroupe, yGraphe + (hauteurGraphe - 20) - hCa, largeurBarre, hCa).fill("#9333ea");
    doc.rect(xGroupe + largeurBarre + 2, yGraphe + (hauteurGraphe - 20) - hCh, largeurBarre, hCh).fill("#f59e0b");
    doc.fillColor("#000").text(m.mois.slice(5), xGroupe - 4, yGraphe + hauteurGraphe - 14, { width: largeurGroupe, align: "center" });
    xGroupe += largeurGroupe;
  }
  doc.y = yGraphe + hauteurGraphe;
  doc.font("Helvetica").fontSize(8);
  doc.fillColor("#9333ea").text("■", margeGauche, doc.y, { continued: true });
  doc.fillColor("#000").text(" Chiffre d'affaires   ", { continued: true });
  doc.fillColor("#f59e0b").text("■", { continued: true });
  doc.fillColor("#000").text(" Charges");
  doc.moveDown(0.6);

  const colonnesMois = ["Mois", "Chiffre d'affaires", "Charges", "Résultat net"];
  const largeursMois = [largeurPage * 0.25, largeurPage * 0.25, largeurPage * 0.25, largeurPage * 0.25];
  function ligneMois(cellules: string[], opts: { gras?: boolean; fond?: string } = {}) {
    const hauteur = 16;
    const yDepart = doc.y;
    if (opts.fond) {
      doc.rect(margeGauche, yDepart, largeurPage, hauteur).fill(opts.fond);
      doc.fillColor("#000");
    }
    doc.font(opts.gras ? "Helvetica-Bold" : "Helvetica").fontSize(7.5);
    let x = margeGauche;
    cellules.forEach((texte, i) => {
      doc.text(texte, x + 4, yDepart + 3, { width: largeursMois[i] - 8, align: i === 0 ? "left" : "right" });
      x += largeursMois[i];
    });
    doc.y = yDepart + hauteur;
  }
  ligneMois(colonnesMois, { gras: true, fond: "#eee" });
  for (const m of rapport.evolutionMensuelle) {
    ligneMois([m.mois, formaterMontant(m.chiffreAffaires), formaterMontant(m.charges), formaterMontant(m.resultatNet)]);
  }
  pied();

  // Compte de résultat normalisé SYSCOHADA.
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).text("Compte de résultat (normalisé SYSCOHADA)");
  doc.font("Helvetica").fontSize(7.5).fillColor("#888").text(rapport.compteDeResultat.statut);
  doc.fillColor("#000");
  doc.moveDown(0.4);

  function sectionCR(titre: string, produits: { label: string; montant: number }[], charges: { label: string; montant: number }[], resultat: number) {
    doc.font("Helvetica-Bold").fontSize(11).text(titre);
    doc.font("Helvetica").fontSize(9);
    for (const p of produits) doc.text(`${p.label} : ${formaterMontant(p.montant)}`);
    for (const c of charges) doc.text(`${c.label} : (${formaterMontant(c.montant)})`);
    doc.font("Helvetica-Bold").text(`Résultat : ${formaterMontant(resultat)}`);
    doc.moveDown(0.5);
  }
  sectionCR("Exploitation", rapport.compteDeResultat.exploitation.produits, rapport.compteDeResultat.exploitation.charges, rapport.compteDeResultat.exploitation.resultat);
  sectionCR("Financier", rapport.compteDeResultat.financier.produits, rapport.compteDeResultat.financier.charges, rapport.compteDeResultat.financier.resultat);
  doc.font("Helvetica-Bold").fontSize(10).text(`Résultat des activités ordinaires : ${formaterMontant(rapport.compteDeResultat.resultatActivitesOrdinaires)}`);
  doc.moveDown(0.3);
  sectionCR("Hors activités ordinaires (HAO)", rapport.compteDeResultat.hao.produits, rapport.compteDeResultat.hao.charges, rapport.compteDeResultat.hao.resultat);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#9333ea").text(`Résultat net avant impôt : ${formaterMontant(rapport.compteDeResultat.resultatNetAvantImpot)}`);
  doc.fillColor("#000");
  pied();

  // Bilan normalisé.
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).text("Bilan (normalisé SYSCOHADA)");
  doc.font("Helvetica").fontSize(8).fillColor("#888").text(`Au ${rapport.bilan.asOf.slice(0, 10)}`);
  doc.fillColor("#000");
  doc.moveDown(0.4);

  function listeBilan(titre: string, lignes: { label: string; montant: number }[]) {
    doc.font("Helvetica-Bold").fontSize(10).text(titre);
    doc.font("Helvetica").fontSize(9);
    for (const l of lignes) doc.text(`${l.label} : ${formaterMontant(l.montant)}`);
    doc.moveDown(0.4);
  }
  doc.font("Helvetica-Bold").fontSize(12).text("Actif");
  doc.moveDown(0.2);
  listeBilan("Immobilisé", rapport.bilan.actif.immobilise);
  listeBilan("Circulant", rapport.bilan.actif.circulant);
  listeBilan("Trésorerie", rapport.bilan.actif.tresorerie);
  doc.font("Helvetica-Bold").fontSize(11).text(`Total actif : ${formaterMontant(rapport.bilan.totalActif)}`);
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12).text("Passif");
  doc.moveDown(0.2);
  listeBilan("Capitaux propres", rapport.bilan.passif.capitauxPropres);
  listeBilan("Dettes financières", rapport.bilan.passif.dettesFinancieres);
  listeBilan("Circulant", rapport.bilan.passif.circulant);
  doc.font("Helvetica-Bold").fontSize(11).text(`Total passif : ${formaterMontant(rapport.bilan.totalPassif)}`);
  if (!rapport.bilan.equilibre) {
    doc.fillColor("#b00").text("Attention : le bilan n'est pas équilibré à cette date.");
    doc.fillColor("#000");
  }
  pied();

  // Répartition des produits/charges — graphique en barres horizontales.
  if (rapport.repartitionProduits.length > 0) {
    doc.addPage();
    const titreRepartition =
      rapport.scope === "PLATFORM" ? "Répartition des revenus par source" : "Principales charges de l'exercice";
    doc.font("Helvetica-Bold").fontSize(16).text(titreRepartition);
    doc.moveDown(0.5);

    // Largeur de la colonne "montant" réservée fixe (pas calculée après la
    // barre) : sinon la plus grande barre, qui remplit tout l'espace
    // disponible, ne laisse presque plus de place pour son propre montant et
    // le texte retombe caractère par caractère (bug trouvé en testant le
    // rendu, 16 oct. 2026).
    const largeurColonneLabel = largeurPage * 0.35;
    const largeurColonneMontant = 70;
    const xBarreDepart = margeGauche + largeurColonneLabel + 10;
    const largeurMaxBarre = largeurPage - largeurColonneLabel - 10 - largeurColonneMontant - 6;
    const maxRepartition = Math.max(...rapport.repartitionProduits.map((r) => r.montant), 1);
    for (const r of rapport.repartitionProduits) {
      const yDepart = doc.y;
      doc.font("Helvetica").fontSize(9).text(r.label, margeGauche, yDepart, { width: largeurColonneLabel });
      const largeurBarreH = Math.max(2, (r.montant / maxRepartition) * largeurMaxBarre);
      doc.rect(xBarreDepart, yDepart, largeurBarreH, 14).fill("#9333ea");
      doc.fillColor("#000").text(formaterMontant(r.montant), xBarreDepart + largeurBarreH + 6, yDepart + 2, {
        width: largeurColonneMontant,
      });
      doc.y = yDepart + 22;
    }
    pied();
  }

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Généré le ${formaterDateHeure(rapport.genereLe)} à partir des écritures comptables réelles.`);
  doc.text(`Code de vérification : ${rapport.codeVerification}`);
  doc.text("Rappel : ce rapport ne remplace pas un état financier certifié ni un audit comptable externe.");
  doc.fillColor("#000");

  doc.end();
  return doc;
}
