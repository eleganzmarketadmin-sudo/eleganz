// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import type { SecteurActiviteBoutique, TypeGarantieCredit, TypeDocumentIdentite } from "@eleganz/database";
import type { DossierCreditBoutique, DossierCreditBoutiqueBusinessPlan } from "./finance.service";

// Libellés français du secteur d'activité (18 nov. 2026) — mêmes valeurs
// que les clés de traduction secteur_<VALEUR> de translations.ts, dupliquées
// ici en dur : les PDF générés côté serveur ne passent jamais par le
// dictionnaire i18n du front (voir les autres libellés de ce fichier/des
// renderers, tous codés en français en dur de la même façon).
export const LIBELLES_SECTEUR_ACTIVITE: Record<SecteurActiviteBoutique, string> = {
  MODE_HABILLEMENT: "Mode, habillement, chaussures",
  ALIMENTATION_AGROALIMENTAIRE: "Alimentation, agroalimentaire",
  ELECTRONIQUE_TELEPHONIE: "Électronique, téléphonie, informatique",
  BEAUTE_COSMETIQUE: "Beauté, cosmétique, hygiène",
  MAISON_DECORATION: "Maison, décoration, ameublement",
  SANTE_PHARMACIE: "Santé, pharmacie, parapharmacie",
  AUTOMOBILE_PIECES: "Automobile, moto, pièces détachées",
  QUINCAILLERIE_BRICOLAGE: "Quincaillerie, bricolage, matériaux de construction",
  AGRICULTURE_ELEVAGE: "Agriculture, élevage",
  ARTISANAT_LOISIRS: "Artisanat, loisirs",
  SERVICES: "Services",
  AUTRE: "Autre",
};

// Libellés français du type de garantie proposée (18 nov. 2026, chantier
// "gestion de risque autonome" Phase 3) — même convention que
// LIBELLES_SECTEUR_ACTIVITE ci-dessus.
export const LIBELLES_TYPE_GARANTIE: Record<TypeGarantieCredit, string> = {
  STOCK_MARCHANDISE: "Stock de marchandises",
  EQUIPEMENT_MATERIEL: "Équipement, matériel professionnel",
  VEHICULE: "Véhicule",
  BIEN_IMMOBILIER: "Bien immobilier",
  CAUTION_PERSONNELLE: "Caution personnelle",
  DEPOT_GARANTIE: "Dépôt de garantie",
  AUTRE: "Autre",
};

// Libellés français du type de document d'identité (18 nov. 2026, chantier
// "gestion de risque autonome" Phase 4, volet KYC) — même convention que
// LIBELLES_SECTEUR_ACTIVITE ci-dessus.
export const LIBELLES_TYPE_DOCUMENT_IDENTITE: Record<TypeDocumentIdentite, string> = {
  PIECE_IDENTITE_DIRIGEANT: "Pièce d'identité du dirigeant",
  REGISTRE_COMMERCE: "Registre de commerce",
  AUTRE: "Autre document",
};

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

// Identité d'une institution partenaire sur les documents qu'elle exporte
// depuis son portail (20 nov. 2026, demande : "menu paramètre pour le
// portail institution afin de libérer les infos... avec entête personnalisé
// et/ou pied de page") — voir Institution.address/logoUrl/headerNote/
// footerNote dans le schéma. `logo` est déjà le buffer récupéré (jamais
// l'URL brute ici : voir recupererLogoDepuisUrl dans common/logo-fetch.util.ts),
// pour que ces fonctions de dessin restent synchrones comme le reste des
// renderers pdfkit de ce fichier.
export interface IdentiteInstitutionPourPdf {
  name: string;
  logo: Buffer | null;
  address: string | null;
  headerNote: string | null;
  footerNote: string | null;
}

/**
 * En-tête personnalisé de l'institution qui exporte ce document — dessiné
 * tout en haut, en flux normal (jamais en position absolue : un logo
 * positionné avec un `y` explicite bloquerait l'avancement de `doc.y`,
 * exactement le bug corrigé le 19 nov. 2026 sur le logo boutique — voir
 * documents/pdf-renderer.ts), avant le titre propre à chaque document.
 * Entièrement facultatif, champ par champ : un champ non renseigné ne
 * dessine simplement rien, jamais un espace vide ni une valeur inventée.
 * Volontairement distincte du titre du document (boutique ou demandeur
 * selon le renderer appelant) : l'institution n'est que celle qui imprime
 * ce document depuis son portail, jamais le sujet du document lui-même.
 */
export function dessinerEnTeteInstitution(doc: PDFKit.PDFDocument, identite: IdentiteInstitutionPourPdf): void {
  if (identite.logo) {
    try {
      doc.image(identite.logo, doc.page.margins.left, undefined, { width: 70 });
      doc.moveDown(0.3);
    } catch {
      // Jamais bloquant (image invalide ou trop grande) — même principe que
      // documents/pdf-renderer.ts.
    }
  }
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text(identite.name);
  if (identite.headerNote) {
    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#555").text(identite.headerNote);
  }
  if (identite.address) {
    doc.font("Helvetica").fontSize(7.5).fillColor("#555").text(identite.address);
  }
  doc.fillColor("#000").font("Helvetica");
  doc.moveDown(0.3);
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurPage, doc.y).strokeColor("#ccc").stroke();
  doc.strokeColor("#000");
  doc.moveDown(0.5);
}

/**
 * Pied de page personnalisé — ne dessine rien si l'institution n'a pas
 * renseigné `footerNote` (jamais un filet vide). Toujours appelé en tout
 * dernier, après le pied de page existant du document (date de génération,
 * code de vérification), jamais à sa place.
 */
export function dessinerPiedPageInstitution(doc: PDFKit.PDFDocument, identite: IdentiteInstitutionPourPdf): void {
  if (!identite.footerNote) return;
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;
  doc.moveDown(0.6);
  doc.moveTo(margeGauche, doc.y).lineTo(margeGauche + largeurPage, doc.y).strokeColor("#ccc").stroke();
  doc.strokeColor("#000");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555").text(identite.footerNote, { width: largeurPage });
  doc.fillColor("#000");
}

export function dessinerSectionBusinessPlan(
  doc: PDFKit.PDFDocument,
  margeGauche: number,
  largeurPage: number,
  bp: DossierCreditBoutiqueBusinessPlan,
) {
  const aDuCanvas =
    bp.canvasSegmentsClientele ||
    bp.canvasPropositionValeur ||
    bp.canvasCanaux ||
    bp.canvasRelationsClients ||
    bp.canvasSourcesRevenus ||
    bp.canvasRessourcesClefs ||
    bp.canvasActivitesClefs ||
    bp.canvasPartenairesClefs ||
    bp.canvasStructureCouts;
  const aDuContenu =
    bp.resumeExecutif || bp.descriptionActivite || bp.marcheEtClientele || bp.strategieCroissance || bp.utilisationFonds || bp.risquesMitigation || aDuCanvas || bp.scenarios.length > 0;
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

  // Business Model Canvas (14 nov. 2026) — les 9 blocs d'Osterwalder, à la
  // suite des sections narratives ci-dessus dans le même dessin pdfkit.
  if (aDuCanvas) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(11).text("Business Model Canvas");
    doc.moveDown(0.2);
    section("Segments de clientèle", bp.canvasSegmentsClientele);
    section("Proposition de valeur", bp.canvasPropositionValeur);
    section("Canaux", bp.canvasCanaux);
    section("Relations avec les clients", bp.canvasRelationsClients);
    section("Sources de revenus", bp.canvasSourcesRevenus);
    section("Ressources clés", bp.canvasRessourcesClefs);
    section("Activités clés", bp.canvasActivitesClefs);
    section("Partenaires clés", bp.canvasPartenairesClefs);
    section("Structure de coûts", bp.canvasStructureCouts);
  }

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

/**
 * Corps financier complet (historique mensuel + bilan + dettes/créances +
 * business plan) d'un DossierCreditBoutique — extrait de
 * dossier-credit-pdf-renderer.ts (16 nov. 2026) pour être réutilisé tel
 * quel par demande-credit-pdf-renderer.ts : le snapshot figé dans
 * DemandeCredit.snapshotDossierCreditJson EST exactement un
 * DossierCreditBoutique (voir DemandeCreditService.soumettre), donc son
 * export PDF doit afficher les mêmes chiffres, présentés de la même
 * façon, jamais une forme réinventée au risque de diverger. N'affiche
 * jamais l'en-tête (identité) ni le pied de page (généré le/code de
 * vérification) : à la charge de l'appelant, qui a sa propre section
 * d'identification (boutique, ou demandeur + boutique pour une demande).
 */
export function dessinerCorpsFinancier(
  doc: PDFKit.PDFDocument,
  margeGauche: number,
  largeurPage: number,
  dossier: DossierCreditBoutique,
) {
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

  dessinerSectionBusinessPlan(doc, margeGauche, largeurPage, dossier.businessPlan);
}
