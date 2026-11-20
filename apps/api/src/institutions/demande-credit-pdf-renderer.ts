// Import CommonJS correct même sans `esModuleInterop` (voir
// documents/pdf-renderer.ts pour l'explication complète du contournement).
import PDFDocument = require("pdfkit");
import { createHash } from "crypto";
import type { DossierCreditBoutique } from "../finance/finance.service";
import {
  formaterDateHeure,
  dessinerCorpsFinancier,
  dessinerEnTeteIdentite,
  dessinerPiedPageIdentite,
  LIBELLES_SECTEUR_ACTIVITE,
  LIBELLES_TYPE_GARANTIE,
  LIBELLES_TYPE_DOCUMENT_IDENTITE,
  type IdentitePourPdf,
} from "../finance/dossier-credit-pdf-shared";
import type { TypeGarantieCredit } from "@eleganz/database";

export interface DemandeCreditPourPdf {
  numero: string;
  statut: string;
  nomDemandeur: string;
  raisonSociale: string | null;
  contactTelephone: string | null;
  contactEmail: string | null;
  montantDemande: number;
  dureeMoisDemandee: number;
  objetFinancement: string | null;
  // Garantie proposée (18 nov. 2026) — purement déclaratif par la
  // boutique, jamais vérifié ni validé par ELEGANZ ; voir le commentaire
  // sur DemandeCredit dans schema.prisma.
  garantieType: TypeGarantieCredit | null;
  garantieDescription: string | null;
  garantieValeurEstimee: number | null;
  createdAt: Date | string;
  institution: { name: string };
  shop: { id: string; name: string; slug: string } | null;
  decision: {
    statut: "ACCORDE" | "REFUSE";
    montant: number;
    tauxAnnuel: number;
    dureeMois: number;
    note: string | null;
    createdAt: Date | string;
  } | null;
  // Figé au moment de la soumission (voir DemandeCreditService.soumettre) —
  // exactement un DossierCreditBoutique, null pour une demande "libre et
  // autonome" créée directement par l'institution (voir
  // DemandeCreditService.creerLibre) sans boutique ELEGANZ rattachée.
  snapshotDossierCreditJson: DossierCreditBoutique | null;
}

const LIBELLES_STATUT: Record<string, string> = {
  RECUE: "Reçue",
  EN_ANALYSE: "En analyse",
  RENDEZ_VOUS_PLANIFIE: "Rendez-vous planifié",
  EN_DECISION: "En décision",
  ACCORDEE: "Accordée",
  REFUSEE: "Refusée",
  DECAISSEE: "Décaissée",
  EN_REMBOURSEMENT: "En remboursement",
  SOLDEE: "Soldée",
};

/**
 * Document d'archive d'UNE candidature de crédit numérotée (16 nov. 2026,
 * demande du 16 nov. 2026 point 3 : "tous les dossiers du client [...]
 * même pour besoin interne [...] pour des raisons d'authenticité et de
 * sécurité, porter les informations d'identification du client et [...]
 * pouvoir les extraire ou imprimer en PDF"). Jusqu'ici ce dossier n'était
 * consultable qu'à l'écran sur /institution/demandes/:numero, sans aucune
 * trace imprimable ou archivable — contrairement au dossier crédit
 * boutique, qui lui dispose de ce PDF depuis le 16 oct. 2026.
 *
 * L'identification du demandeur (nom, raison sociale, contacts) est
 * TOUJOURS affichée, même sans snapshot (cas d'une demande "libre" sur un
 * prospect sans boutique ELEGANZ) — c'est le cœur de la demande du 16 nov.
 * 2026. Le corps financier (historique, bilan, business plan) n'est
 * affiché que si un snapshot a été figé à la soumission, via
 * dessinerCorpsFinancier — partagé avec dossier-credit-pdf-renderer.ts,
 * jamais une forme réinventée ici.
 *
 * Le code de vérification porte spécifiquement sur CE document (numéro,
 * statut, montant, décision, et le code de vérification du snapshot joint
 * s'il existe) — distinct du code de vérification propre au snapshot
 * lui-même, qui reste inchangé et vérifiable indépendamment.
 *
 * `identiteInstitution` (20 nov. 2026) — en-tête/pied de page personnalisés
 * de l'institution qui exporte ce document, voir institution-portal.
 * service.ts. Toujours fourni ici (contrairement à renderDossierCreditPdf) :
 * cette fonction n'est jamais appelée hors du portail Institutions.
 */
export function renderDemandeCreditPdf(
  demande: DemandeCreditPourPdf,
  identiteInstitution: IdentitePourPdf,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const margeGauche = doc.page.margins.left;
  const largeurPage = doc.page.width - margeGauche - doc.page.margins.right;

  dessinerEnTeteIdentite(doc, identiteInstitution);

  doc.font("Helvetica-Bold").fontSize(16).text("Dossier de candidature de crédit", { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#333").text(`${demande.numero} — ${demande.institution.name}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(0.6);

  const yBandeau = doc.y;
  doc.rect(margeGauche, yBandeau, largeurPage, 46).fill("#fff3cd");
  doc.fillColor("#664d03").font("Helvetica-Bold").fontSize(9);
  doc.text(
    "Document d'archive interne retraçant une candidature de crédit soumise via le portail Institutions ELEGANZ. " +
      "Ce n'est pas une attestation comptable ou fiscale officielle, ni une confirmation d'octroi de prêt.",
    margeGauche + 10,
    yBandeau + 7,
    { width: largeurPage - 20 },
  );
  doc.fillColor("#000").font("Helvetica");
  doc.y = yBandeau + 54;

  // Identification du demandeur — toujours affichée, snapshot ou non
  // (voir le commentaire de la fonction).
  doc.font("Helvetica-Bold").fontSize(11).text("Identification du demandeur");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Nom : ${demande.nomDemandeur}`);
  if (demande.raisonSociale) {
    doc.text(`Raison sociale : ${demande.raisonSociale}`);
  }
  if (demande.contactTelephone) {
    doc.text(`Téléphone : ${demande.contactTelephone}`);
  }
  if (demande.contactEmail) {
    doc.text(`Email : ${demande.contactEmail}`);
  }
  doc.text(
    demande.shop
      ? `Boutique ELEGANZ rattachée : ${demande.shop.name}`
      : "Dossier libre — prospect sans boutique ELEGANZ rattachée au moment de la candidature.",
  );
  if (demande.snapshotDossierCreditJson?.secteurActivite) {
    doc.text(`Secteur d'activité : ${LIBELLES_SECTEUR_ACTIVITE[demande.snapshotDossierCreditJson.secteurActivite]}`);
  }
  if (demande.snapshotDossierCreditJson?.documentsIdentite?.length) {
    const libelles = demande.snapshotDossierCreditJson.documentsIdentite
      .map((d) => LIBELLES_TYPE_DOCUMENT_IDENTITE[d.type as keyof typeof LIBELLES_TYPE_DOCUMENT_IDENTITE] ?? d.type)
      .join(", ");
    doc.text(`Documents d'identité joints (déclaratifs, non vérifiés par ELEGANZ) : ${libelles}`);
  }
  doc.moveDown(0.6);

  doc.font("Helvetica-Bold").fontSize(11).text("Détails de la candidature");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Numéro de suivi : ${demande.numero}`);
  doc.text(`Date de soumission : ${formaterDateHeure(typeof demande.createdAt === "string" ? demande.createdAt : demande.createdAt.toISOString())}`);
  doc.text(`Statut actuel : ${LIBELLES_STATUT[demande.statut] ?? demande.statut}`);
  doc.text(`Montant demandé : ${Math.round(demande.montantDemande).toLocaleString("fr-FR")}`);
  doc.text(`Durée demandée : ${demande.dureeMoisDemandee} mois`);
  if (demande.objetFinancement) {
    doc.text(`Objet du financement : ${demande.objetFinancement}`);
  }
  if (demande.garantieType) {
    const detail = [demande.garantieDescription, demande.garantieValeurEstimee != null ? `valeur estimée ${Math.round(demande.garantieValeurEstimee).toLocaleString("fr-FR")}` : null]
      .filter(Boolean)
      .join(" — ");
    doc.text(`Garantie proposée (déclarative, non vérifiée par ELEGANZ) : ${LIBELLES_TYPE_GARANTIE[demande.garantieType]}${detail ? ` — ${detail}` : ""}`);
  }
  doc.moveDown(0.6);

  if (demande.decision) {
    doc.font("Helvetica-Bold").fontSize(11).text("Décision rendue");
    doc.font("Helvetica").fontSize(9);
    doc.text(`Verdict : ${demande.decision.statut === "ACCORDE" ? "Accordé" : "Refusé"}`);
    doc.text(`Montant : ${Math.round(demande.decision.montant).toLocaleString("fr-FR")}`);
    doc.text(`Taux annuel : ${demande.decision.tauxAnnuel.toLocaleString("fr-FR")} %`);
    doc.text(`Durée : ${demande.decision.dureeMois} mois`);
    if (demande.decision.note) {
      doc.text(`Note : ${demande.decision.note}`);
    }
    doc.text(
      `Date de la décision : ${formaterDateHeure(typeof demande.decision.createdAt === "string" ? demande.decision.createdAt : demande.decision.createdAt.toISOString())}`,
    );
    doc.moveDown(0.6);
  }

  // Corps financier figé à la soumission (16 nov. 2026) — absent pour une
  // demande "libre" (voir DemandeCreditPourPdf.snapshotDossierCreditJson).
  if (demande.snapshotDossierCreditJson) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(13).text("Dossier financier joint (instantané à la soumission)");
    doc.font("Helvetica").fontSize(8).fillColor("#555").text(
      `Figé le ${formaterDateHeure(demande.snapshotDossierCreditJson.genereLe)} — code de vérification du dossier joint : ${demande.snapshotDossierCreditJson.codeVerification}`,
    );
    doc.fillColor("#000");
    doc.moveDown(0.4);
    dessinerCorpsFinancier(doc, margeGauche, largeurPage, demande.snapshotDossierCreditJson);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor("#555");
    doc.text("Aucun dossier financier joint à cette candidature (demande libre, sans boutique ELEGANZ rattachée).");
    doc.fillColor("#000");
  }

  const codeVerification = createHash("sha256")
    .update(
      [
        demande.numero,
        demande.statut,
        demande.montantDemande,
        demande.decision?.statut ?? "",
        demande.decision?.montant ?? "",
        demande.snapshotDossierCreditJson?.codeVerification ?? "",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(7.5).fillColor("#555");
  doc.text(`Document généré le ${formaterDateHeure(new Date().toISOString())}.`);
  doc.text(`Code de vérification de ce document : ${codeVerification}`);
  doc.fillColor("#000");

  dessinerPiedPageIdentite(doc, identiteInstitution);

  doc.end();
  return doc;
}
