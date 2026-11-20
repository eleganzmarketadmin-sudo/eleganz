// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { DossierCreditBoutique } from "./finance.service";
import {
  formaterDate,
  formaterDateHeure,
  dessinerCorpsFinancier,
  dessinerEnTeteIdentite,
  dessinerPiedPageIdentite,
  LIBELLES_SECTEUR_ACTIVITE,
  type IdentitePourPdf,
} from "./dossier-credit-pdf-shared";

/**
 * Dossier de crédit boutique (demande du 16 oct. 2026, point 1) — pendant
 * du "Dossier de financement" d'ELEGANZ Mon assistant
 * (comptable-pdf-renderer.ts), mais construit à partir des écritures
 * comptables réelles de la boutique plutôt que d'une saisie déclarative.
 * Le bandeau d'avertissement ("non certifié") est répété comme sur l'autre
 * dossier, par cohérence et pour la même raison de conformité.
 *
 * `identiteInstitution` facultatif (20 nov. 2026) : cette fonction est
 * appelée aussi bien depuis finance.controller.ts (export par la boutique
 * elle-même, aucune institution impliquée) que depuis
 * institution-portal.controller.ts (export par une institution partenaire,
 * qui y ajoute son propre en-tête/pied de page) — voir institution-
 * portal.service.ts pour la construction de cet objet.
 */
export function renderDossierCreditPdf(
  dossier: DossierCreditBoutique,
  identiteInstitution?: IdentitePourPdf,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  if (identiteInstitution) {
    dessinerEnTeteIdentite(doc, identiteInstitution);
  }

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
  if (dossier.secteurActivite) {
    doc.text(`Secteur d'activité : ${LIBELLES_SECTEUR_ACTIVITE[dossier.secteurActivite]}`);
  }
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

  // Historique + bilan + dettes/créances + business plan (16 nov. 2026,
  // extrait dans dessinerCorpsFinancier pour être réutilisé tel quel par
  // demande-credit-pdf-renderer.ts — voir son commentaire).
  dessinerCorpsFinancier(doc, margeGauche, largeurPage, dossier);

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Généré le ${formaterDateHeure(dossier.genereLe)} à partir des écritures comptables réelles de la boutique sur ELEGANZ.`);
  doc.text(`Code de vérification : ${dossier.codeVerification}`);
  doc.text(
    "Rappel : ce dossier ne remplace pas un état financier certifié, un audit comptable ou une attestation fiscale.",
  );
  doc.fillColor("#000");

  if (identiteInstitution) {
    dessinerPiedPageIdentite(doc, identiteInstitution);
  }

  doc.end();
  return doc;
}
