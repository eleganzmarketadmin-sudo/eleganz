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

/**
 * Identité fiscale et juridique de la boutique (14 nov. 2026, prompt
 * "AJOUTER les identifications fiscales et juridiques de la boutique") —
 * reprend les mêmes champs que le module Finance ("Règles fiscales"), pour
 * affichage uniquement sur le document quand la boutique a activé la
 * présentation normalisée auto-déclarée (`normalisationAutoDeclaree`).
 */
export interface IdentiteFiscaleDocumentPdf {
  fiscalLegalName?: string | null;
  fiscalLegalForm?: string | null;
  fiscalIdNumber?: string | null;
  fiscalAddress?: string | null;
  fiscalJurisdiction?: string | null;
  fiscalRegime?: string | null;
  fiscalVatRegistered?: boolean | null;
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
  /**
   * Coordonnées officielles ELEGANZ (Centre de pilotage, section "Paramètres
   * plateforme") — affichées dans la signature fixe en bas de chaque
   * document, en plus de l'identité de la boutique ci-dessus.
   */
  platformWebsite?: string | null;
  platformSupportEmail?: string | null;
  platformSupportPhone?: string | null;
  /**
   * Présentation normalisée auto-déclarée (14 nov. 2026, voir
   * Shop.normalisationAutoDeclaree dans schema.prisma) — active l'affichage
   * du bloc d'identité fiscale ci-dessous et adapte le texte de bas de
   * page. Ne modifie jamais `isFiscallyHomologated` ni le type réel du
   * document (toujours INVOICE_INTERNAL dans ce cas, jamais INVOICE_FISCAL)
   * — ce n'est qu'une présentation plus complète choisie par la boutique
   * elle-même, jamais une déclaration d'homologation DGI réelle. Voir
   * docs/COMPLIANCE_FACTURE_NORMALISEE.md.
   */
  normalisationAutoDeclaree?: boolean;
  identiteFiscale?: IdentiteFiscaleDocumentPdf | null;
  /**
   * Identité du client final (19 nov. 2026, demande : "ajouter à la facture
   * les champs optionnels... identité du client et son numéro phone
   * whatsapp") — toujours facultatif, jamais de valeur inventée : vide pour
   * une vente caisse sans client saisi, rempli depuis `ShopCustomer` (caisse)
   * ou `Order.buyer`/`buyerWhatsapp` (commande Marketplace) sinon. Voir
   * documents.service.ts::rendrerDocumentCharge.
   */
  customerName?: string | null;
  customerPhone?: string | null;
  /**
   * Code-barres (Code128, encode `number` ci-dessus) et QR code (encode le
   * lien public de vérification du document) — même mécanisme non-bloquant
   * que `shopLogo` : générés au préalable par l'appelant
   * (documents.service.ts), jamais ici ; `null` si la génération a échoué ou
   * si le QR ne peut pas être calculé (hôte de la requête inconnu). Le rendu
   * PDF lui-même ne fait toujours aucun accès réseau.
   */
  barcode?: Buffer | null;
  qrCode?: Buffer | null;
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

  // Bloc d'identité fiscale — uniquement si la boutique a activé la
  // présentation normalisée auto-déclarée (14 nov. 2026). Jamais affiché par
  // défaut, jamais de donnée inventée : uniquement ce que la boutique a
  // renseigné elle-même dans Paramètres.
  if (donnees.normalisationAutoDeclaree && donnees.identiteFiscale) {
    const fi = donnees.identiteFiscale;
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(7);
    const ligneRaison = [fi.fiscalLegalName, fi.fiscalLegalForm]
      .filter((v): v is string => Boolean(v))
      .join(" — ");
    if (ligneRaison) doc.text(ligneRaison, { align: "center" });
    if (fi.fiscalIdNumber) doc.text(`Id. ${fi.fiscalIdNumber}`, { align: "center" });
    if (fi.fiscalAddress) doc.text(fi.fiscalAddress, { align: "center" });
    const ligneRegime = [fi.fiscalJurisdiction, fi.fiscalRegime]
      .filter((v): v is string => Boolean(v))
      .join(" — ");
    if (ligneRegime) doc.text(ligneRegime, { align: "center" });
    if (fi.fiscalVatRegistered) doc.text("Assujetti à la TVA", { align: "center" });
  }

  doc.moveDown(0.5);
  doc.fontSize(8).text(`N° ${donnees.number}`, { align: "center" });
  doc.text(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      donnees.createdAt,
    ),
    { align: "center" },
  );

  // Bloc client — uniquement si une identité a été saisie/connue (19 nov.
  // 2026). Jamais de placeholder du type "Client inconnu" : simplement
  // absent quand rien n'a été renseigné, comme les autres blocs facultatifs
  // de ce document.
  if (donnees.customerName || donnees.customerPhone) {
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(7.5);
    const ligneClient = [donnees.customerName, donnees.customerPhone].filter(Boolean).join(" — ");
    doc.text(`Client : ${ligneClient}`, { align: "center" });
  }

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
        : donnees.normalisationAutoDeclaree
          ? "Présentation normalisée auto-déclarée par la boutique — en attente de connexion à la plateforme DGI, non homologuée."
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
    .text(
      donnees.platformWebsite || "Mode et luxe choisis chez des boutiques congolaises — eleganz-production.up.railway.app/marketplace",
      { align: "center" },
    );
  // Coordonnées de contact officielles (centre de pilotage → "Paramètres
  // plateforme") — affichées seulement si renseignées par l'admin, jamais de
  // valeur inventée (prompt du 12 oct. 2026, demande n°2).
  const contactsPlateforme = [donnees.platformSupportEmail, donnees.platformSupportPhone]
    .filter((v): v is string => Boolean(v))
    .join("  ·  ");
  if (contactsPlateforme) {
    doc.fontSize(6.5).fillColor("#555").text(contactsPlateforme, { align: "center" });
  }
  doc.fillColor("#000");

  // Code-barres + QR code (19 nov. 2026, demande : "voir la possibilité d'un
  // qr code/code barre"). `y` explicitement `undefined` (3e argument
  // positionnel) plutôt qu'omis : `@types/pdfkit` ne déclare `x`/`y` que sur
  // cette surcharge positionnelle, pas dans `ImageOption` (qui existe
  // pourtant bel et bien à l'exécution — voir pdfkit.js, fonction `image`) ;
  // passer `undefined` satisfait le typage ET laisse pdfkit en mode "flux"
  // (`inDocumentFlow = typeof y !== "number"`), qui avance `doc.y` de la
  // hauteur réellement dessinée — contrairement au logo ci-dessus, positionné
  // en absolu (voir son commentaire), on ne veut jamais ici qu'un bloc
  // suivant chevauche visuellement ces images.
  if (donnees.barcode) {
    try {
      doc.moveDown(0.5);
      // Largeur réduite à 55 % de la largeur disponible, centrée (19 nov.
      // 2026, demande : "réduire la taille des codes barres question
      // d'espace") — auparavant toute la largeur du ticket ; pdfkit
      // conserve le ratio largeur/hauteur de l'image source, donc réduire
      // `width` ici réduit aussi sa hauteur imprimée.
      const largeurDisponible = LARGEUR_TICKET - MARGE * 2;
      const largeurCode = Math.round(largeurDisponible * 0.55);
      const xCode = MARGE + (largeurDisponible - largeurCode) / 2;
      doc.image(donnees.barcode, xCode, undefined, { width: largeurCode });
    } catch {
      // Code-barres illisible (buffer corrompu...) — jamais bloquant.
    }
  }
  if (donnees.qrCode) {
    try {
      doc.moveDown(0.3);
      const largeurQr = 72;
      doc.image(donnees.qrCode, (LARGEUR_TICKET - largeurQr) / 2, undefined, { width: largeurQr });
      doc.moveDown(0.15);
      doc
        .font("Helvetica")
        .fontSize(6)
        .fillColor("#555")
        .text("Scannez pour retrouver ce document en ligne", { align: "center" });
      doc.fillColor("#000");
    } catch {
      // QR illisible — jamais bloquant.
    }
  }

  doc.end();
  return doc;
}
