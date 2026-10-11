import PDFDocument from "pdfkit";

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
  totalAmount: number;
  isFiscallyHomologated: boolean;
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

  doc.font("Helvetica-Bold").fontSize(12).text(donnees.shopName, { align: "center" });
  doc.font("Helvetica").fontSize(9).text(donnees.documentTypeLabel, { align: "center" });
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

  doc.end();
  return doc;
}
