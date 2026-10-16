// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { DossierCreditBoutique } from "./finance.service";

function formaterMontant(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")}`;
}

function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
}

function formaterDateHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

/**
 * Dossier de crédit boutique (demande du 16 oct. 2026, point 1) — pendant
 * du "Dossier de financement" d'ELEGANZ Mon assistant
 * (comptable-pdf-renderer.ts), mais construit à partir des écritures
 * comptables réelles de la boutique plutôt que d'une saisie déclarative.
 * Le bandeau d'avertissement ("non certifié") est répété comme sur l'autre
 * dossier, par cohérence et pour la même raison de conformité.
 */
export function renderDossierCreditPdf(dossier: DossierCreditBoutique): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(16).text("Dossier de crédit — demande de financement", { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#333").text(dossier.shopName, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(0.6);

  const yBandeau = doc.y;
  doc.rect(margeGauche, yBandeau, largeurPage, 46).fill("#fff3cd");
  doc.fillColor("#664d03").font("Helvetica-Bold").fontSize(9);
  doc.text(
    "Ce document n'est PAS un état financier certifié ni une attestation comptable ou fiscale officielle. " +
      "Il rassemble, à titre préparatoire, les données comptables réellement enregistrées par cette boutique sur " +
      "ELEGANZ, pour appuyer une démarche de financement auprès d'une institution financière.",
    margeGauche + 10,
    yBandeau + 7,
    { width: largeurPage - 20 },
  );
  doc.fillColor("#000").font("Helvetica");
  doc.y = yBandeau + 54;

  doc.font("Helvetica-Bold").fontSize(11).text("Identité de la boutique");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Boutique ELEGANZ depuis le ${formaterDate(dossier.boutiqueDepuis)}`);
  if (dossier.identiteFiscale.fiscalLegalName) {
    doc.text(`Raison sociale : ${dossier.identiteFiscale.fiscalLegalName}`);
  }
  if (dossier.identiteFiscale.fiscalIdNumber) {
    doc.text(`Identifiant fiscal : ${dossier.identiteFiscale.fiscalIdNumber}`);
  }
  if (dossier.identiteFiscale.fiscalAddress) {
    doc.text(`Adresse : ${dossier.identiteFiscale.fiscalAddress}`);
  }
  if (dossier.identiteFiscale.fiscalRegime) {
    doc.text(`Régime fiscal déclaré : ${dossier.identiteFiscale.fiscalRegime}`);
  }
  doc.moveDown(0.6);

  doc.font("Helvetica-Bold").fontSize(11).text(`Historique sur ${dossier.historiqueMensuel.length} mois`);
  doc.moveDown(0.2);

  const colonnes = ["Mois", "Chiffre d'affaires", "Charges", "Résultat net"];
  const largeurs = [largeurPage * 0.25, largeurPage * 0.25, largeurPage * 0.25, largeurPage * 0.25];
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
    dessinerLigne([m.mois, formaterMontant(m.chiffreAffaires), formaterMontant(m.charges), formaterMontant(m.resultatNet)]);
  }

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).text("Bilan à ce jour");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Total actif : ${formaterMontant(dossier.bilan.totalActif)}`);
  doc.text(`Total passif : ${formaterMontant(dossier.bilan.totalPassif)}`);
  if (!dossier.bilan.equilibre) {
    doc.fillColor("#b00").text("Attention : le bilan n'est pas équilibré à cette date.");
    doc.fillColor("#000");
  }
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").fontSize(11).text("Dettes et créances");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Dettes fournisseurs (solde cumulé) : ${formaterMontant(dossier.dettesFournisseurs)}`);
  doc.text(`Crédit accordé aux clients (solde cumulé) : ${formaterMontant(dossier.creditClientAccorde)}`);

  // Business plan et scénarios de prêt (16 oct. 2026, point 1) — sur une
  // nouvelle page : contenu narratif potentiellement long, distinct des
  // tableaux chiffrés ci-dessus.
  const bp = dossier.businessPlan;
  const aDuContenu =
    bp.resumeExecutif || bp.descriptionActivite || bp.marcheEtClientele || bp.strategieCroissance || bp.utilisationFonds || bp.risquesMitigation || bp.scenarios.length > 0;
  if (aDuContenu) {
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

    if (bp.scenarios.length > 0) {
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

      // Graphique vectoriel (barres) comparant la mensualité de chaque
      // scénario — pas de dépendance d'image/canvas, dessiné à la main avec
      // les primitives pdfkit (voir decision 16 oct. 2026 : pas de canvas
      // natif, risque de compilation sur Railway).
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
  }

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Généré le ${formaterDateHeure(dossier.genereLe)} à partir des écritures comptables réelles de la boutique sur ELEGANZ.`);
  doc.text(`Code de vérification : ${dossier.codeVerification}`);
  doc.text(
    "Rappel : ce dossier ne remplace pas un état financier certifié, un audit comptable ou une attestation fiscale.",
  );
  doc.fillColor("#000");

  doc.end();
  return doc;
}
