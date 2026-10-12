// Import CommonJS correct même sans `esModuleInterop` (le type pdfkit est
// déclaré en `export =`) — c'est l'absence de cet interop qui causait le
// "pdfkit_1.default is not a constructor" en production : TypeScript
// compilait `import PDFDocument from "pdfkit"` en `require("pdfkit").default`,
// qui n'existe pas sur un module CommonJS classique comme pdfkit.
import PDFDocument = require("pdfkit");

export interface LigneDocumentPdf {
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface PaiementDocumentPdf {
  method: string;
  amount: number;
}

export interface DonneesDocumentPdf {
  shopName: string;
  documentTypeLabel: string;
  number: string;
  createdAt: Date;
  currency: string;
  lines: LigneDocumentPdf[];
  payments?: PaiementDocumentPdf[];
  /**
   * Note affichée à la place du détail des paiements quand aucun paiement
   * réel n'est encore enregistré (commandes Marketplace : le règlement se
   * fait à la livraison, aucune intégration de paiement n'est branchée
   * encore — décision #2). Ne jamais inventer un paiement confirmé.
   */
  noteReglement?: string;
  totalAmount: number;
  isFiscallyHomologated: boolean;
  /**
   * Identité de la boutique sur le document (prompt du 12 oct. 2026) —
   * personnalisable par chaque vendeur, tous facultatifs. `shopLogoUrl`
   * n'est utilisé que si l'image a pu être récupérée au préalable par
   * l'appelant (voir `recupererLogo` / `documents.service.ts`) : le rendu
   * PDF lui-même ne fait jamais d'accès réseau.
   */
  shopAddress?: string | null;
  shopPhone?: string | null;
  shopLogo?: Buffer | null;
  shopFooterNote?: string | null;
}

const LARGEUR_TICKET = 226; // ~80mm, format imprimante de caisse courant (prompt §6)
const MARGE = 16;

function formaterMontant(montant: number, devise: string): string {
  const entier = Math.round(montant);
  const chiffres = Math.abs(entier).toString();
  const groupes: string[] = [];
  for (let i = chiffres.length; i > 0; i -= 3) {
    groupes.unshift(chiffres.slice(Math.max(0, i - 3), i));
  }
  const corps = groupes.join(" ");
  return devise === "CDF" ? `${corps} FC` : `$${montant.toFixed(2)}`;
}

/**
 * Rend un document commercial (ticket, reçu, facture interne, ...) au format
 * PDF adapté à une imprimante de caisse (prompt §6). Ne produit jamais un
 * document marqué fiscalement homologué : `isFiscallyHomologated` est
 * toujours lu depuis la base, jamais déduit ici — voir
 * docs/COMPLIANCE_FACTURE_NORMALISEE.md.
 */
export function renderDocumentPdf(donnees: DonneesDocumentPdf): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: [LARGEUR_TICKET, 842], margin: MARGE });

  // Logo de la boutique, si elle en a fourni un et qu'il a pu être récupéré
  // (voir documents.service.ts) — jamais bloquant : une image invalide ou
  // trop grande ne doit jamais faire échouer tout le document.
  if (donnees.shopLogo) {
    try {
      const largeurLogo = 60;
      doc.image(donnees.shopLogo, (LARGEUR_TICKET - largeurLogo) / 2, doc.y, { width: largeurLogo });
      doc.moveDown(0.3);
    } catch {
      // Logo illisible (format non supporté, fichier corrompu...) — on
      // continue sans jamais faire planter la génération du document.
    }
  }

  doc.font("Helvetica-Bold").fontSize(12).text(donnees.shopName, { align: "center" });
  doc.font("Helvetica").fontSize(9).text(donnees.documentTypeLabel, { align: "center" });
  if (donnees.shopAddress) {
    doc.fontSize(7.5).text(donnees.shopAddress, { align: "center" });
  }
  if (donnees.shopPhone) {
    doc.fontSize(7.5).text(`Tél. ${donnees.shopPhone}`, { align: "center" });
  }
  doc.moveDown(0.5);
  doc.fontSize(8).text(`N° ${donnees.number}`, { align: "center" });
  doc.text(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      donnees.createdAt,
    ),
    { align: "center" },
  );
  doc.moveDown(0.5);
  doc
    .moveTo(MARGE, doc.y)
    .lineTo(LARGEUR_TICKET - MARGE, doc.y)
    .stroke();
  doc.moveDown(0.5);

  for (const ligne of donnees.lines) {
    const montantLigne = ligne.quantity * ligne.unitPrice;
    doc.fontSize(8).text(ligne.label);
    doc
      .fontSize(8)
      .text(
        `${ligne.quantity} × ${formaterMontant(ligne.unitPrice, donnees.currency)}`,
        MARGE,
        doc.y,
        { continued: true, width: LARGEUR_TICKET - MARGE * 2 - 60 },
      )
      .text(formaterMontant(montantLigne, donnees.currency), { align: "right" });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.3);
  doc
    .moveTo(MARGE, doc.y)
    .lineTo(LARGEUR_TICKET - MARGE, doc.y)
    .stroke();
  doc.moveDown(0.3);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("TOTAL", MARGE, doc.y, { continued: true, width: LARGEUR_TICKET - MARGE * 2 - 70 })
    .text(formaterMontant(donnees.totalAmount, donnees.currency), { align: "right" });

  if (donnees.payments?.length) {
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(8);
    for (const paiement of donnees.payments) {
      doc.text(`${paiement.method} : ${formaterMontant(paiement.amount, donnees.currency)}`);
    }
  } else if (donnees.noteReglement) {
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(8).text(donnees.noteReglement, { align: "center" });
  }

  if (donnees.shopFooterNote) {
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(7.5).text(donnees.shopFooterNote, { align: "center" });
  }

  doc.moveDown(0.8);
  doc
    .fontSize(7)
    .fillColor("#555")
    .text(
      donnees.isFiscallyHomologated
        ? "Document fiscal homologué DGI."
        : "Document non homologué par la DGI — à conserver pour votre comptabilité interne.",
      { align: "center" },
    );
  doc.fillColor("#000");

  // Signature de la plateforme — fixe, identique sur tous les documents de
  // toutes les boutiques (contrairement à l'identité du vendeur ci-dessus,
  // qui est personnalisable). Prompt du 12 oct. 2026.
  doc.moveDown(0.6);
  doc
    .moveTo(MARGE, doc.y)
    .lineTo(LARGEUR_TICKET - MARGE, doc.y)
    .dash(1, { space: 1 })
    .stroke();
  doc.undash();
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#555")
    .text("Vendu via ELEGANZ Marketplace", { align: "center" });
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#555")
    .text("Mode et luxe choisis chez des boutiques congolaises — eleganz-production.up.railway.app/marketplace", {
      align: "center",
    });
  doc.fillColor("#000");

  doc.end();
  return doc;
}
