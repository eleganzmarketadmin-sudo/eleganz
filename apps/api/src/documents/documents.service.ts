import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentType, Prisma } from "@eleganz/database";
import { renderDocumentPdf } from "./pdf-renderer";
import { construireClasseurExcel } from "../common/xlsx.util";
import { AdminSettingsService } from "../admin-settings/admin-settings.service";
// Import CommonJS correct même sans `esModuleInterop` — même remarque que
// pour pdfkit (voir pdf-renderer.ts) : bwip-js déclare son module avec
// `export =`.
import bwipjs = require("bwip-js");

const LABELS_PAIEMENT: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile money",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  STORE_CREDIT: "Crédit client",
  CASH_ON_DELIVERY: "Paiement à la livraison",
};

const LABELS_TYPE: Record<DocumentType, string> = {
  TICKET: "Ticket de caisse",
  RECEIPT: "Reçu",
  INVOICE_INTERNAL: "Facture interne",
  INVOICE_FISCAL: "Facture fiscale homologuée",
  PROFORMA: "Facture proforma",
  QUOTE: "Devis",
  CREDIT_NOTE: "Note de crédit",
  DELIVERY_NOTE: "Bon de livraison",
};

// Types émis sans restriction tant que l'homologation DGI n'est pas confirmée
// (décision #9, docs/COMPLIANCE_FACTURE_NORMALISEE.md). INVOICE_FISCAL est
// volontairement absent de cette liste : il ne doit pas pouvoir être généré
// par ce chemin de code avant que l'homologation soit vérifiée manuellement.
const NON_HOMOLOGATED_TYPES: DocumentType[] = [
  DocumentType.TICKET,
  DocumentType.RECEIPT,
  DocumentType.INVOICE_INTERNAL,
  DocumentType.PROFORMA,
  DocumentType.QUOTE,
  DocumentType.CREDIT_NOTE,
  DocumentType.DELIVERY_NOTE,
];

// Extrait de renderPdf/renderPdfPublic (12 nov. 2026) — même jeu de relations
// chargées quel que soit le mode d'accès (authentifié par boutique, ou
// public par lien de partage), seul le `where` du findFirst diffère.
const DOCUMENT_INCLUDE_POUR_PDF = {
  shop: {
    select: {
      name: true,
      invoiceAddress: true,
      invoicePhone: true,
      invoiceLogoUrl: true,
      invoiceFooterNote: true,
      // Présentation de facture normalisée auto-déclarée (14 nov. 2026) —
      // voir le commentaire de Shop.normalisationAutoDeclaree : seulement
      // affichée sur le document si la boutique a elle-même activé ce
      // réglage ; jamais lié à fiscalHomologationConfirmed/INVOICE_FISCAL.
      normalisationAutoDeclaree: true,
      fiscalLegalName: true,
      fiscalLegalForm: true,
      fiscalIdNumber: true,
      fiscalAddress: true,
      fiscalJurisdiction: true,
      fiscalRegime: true,
      fiscalVatRegistered: true,
    },
  },
  posSale: {
    include: {
      lines: true,
      payments: true,
      // Identité client (19 nov. 2026, demande : "identité du client et son
      // numéro phone whatsapp") — `customer` reste `null` tant qu'aucun nom/
      // téléphone n'a été saisi à l'encaissement (voir PosService.createSale
      // /resoudreClientLibre) ; jamais de valeur inventée côté rendu.
      customer: { select: { fullName: true, phone: true } },
    },
  },
  shopOrder: {
    include: {
      lines: { include: { variant: { include: { product: true } } } },
      order: { select: { currency: true, buyer: { select: { fullName: true } }, buyerWhatsapp: true, buyerPhone: true } },
    },
  },
} satisfies Prisma.CommercialDocumentInclude;

type DocumentAvecRelationsPourPdf = Prisma.CommercialDocumentGetPayload<{
  include: typeof DOCUMENT_INCLUDE_POUR_PDF;
}>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSettings: AdminSettingsService,
  ) {}

  /**
   * Génère un document commercial lié à une vente de caisse. N'émet jamais
   * INVOICE_FISCAL — voir docs/COMPLIANCE_FACTURE_NORMALISEE.md pour la
   * procédure à suivre avant d'activer ce type, une fois l'homologation DGI
   * obtenue (décision #9 : les deux versions seront proposées au choix,
   * mais seule la version non homologuée est automatisée pour l'instant).
   */
  async generateForPosSale(shopId: string, posSaleId: string, type: DocumentType) {
    const estHomologuee = await this.verifierTypeAutorise(shopId, type);

    const number = await this.nextNumber(shopId, type);

    return this.prisma.commercialDocument.create({
      data: {
        shopId,
        posSaleId,
        type,
        number,
        isFiscallyHomologated: estHomologuee,
      },
    });
  }

  /**
   * Génère un document commercial lié à une sous-commande Marketplace reçue
   * par la boutique (`ShopOrder`, pas `PosSale`). Même garde-fou qu'en
   * caisse : jamais INVOICE_FISCAL par ce chemin.
   */
  async generateForShopOrder(shopId: string, shopOrderId: string, type: DocumentType) {
    const estHomologuee = await this.verifierTypeAutorise(shopId, type);

    const shopOrder = await this.prisma.shopOrder.findFirst({ where: { id: shopOrderId, shopId } });
    if (!shopOrder) {
      throw new NotFoundException("Commande introuvable pour cette boutique.");
    }

    const number = await this.nextNumber(shopId, type);

    return this.prisma.commercialDocument.create({
      data: {
        shopId,
        shopOrderId,
        type,
        number,
        isFiscallyHomologated: estHomologuee,
      },
    });
  }

  /**
   * Autorise INVOICE_FISCAL uniquement pour une boutique dont l'homologation
   * DGI a été confirmée manuellement par un administrateur
   * (`fiscalHomologationConfirmed`, voir admin/shops/:id/fiscal-homologation)
   * — décision #9 : les deux formats sont proposés au choix, mais
   * INVOICE_FISCAL reste bloqué par défaut tant que ce drapeau n'est pas
   * activé. Les autres types restent toujours disponibles sans condition.
   */
  private async verifierTypeAutorise(shopId: string, type: DocumentType): Promise<boolean> {
    if (NON_HOMOLOGATED_TYPES.includes(type)) {
      return false;
    }
    if (type === DocumentType.INVOICE_FISCAL) {
      const shop = await this.prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { fiscalHomologationConfirmed: true },
      });
      if (!shop.fiscalHomologationConfirmed) {
        throw new BadRequestException(
          "La facture fiscale homologuée n'est pas encore disponible pour cette boutique : l'homologation DGI doit d'abord être confirmée par l'administration ELEGANZ (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).",
        );
      }
      return true;
    }
    throw new BadRequestException(
      `${type} ne peut pas être généré automatiquement (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).`,
    );
  }

  /**
   * Vue "Mes factures / ventes" (prompt du 12 oct. 2026) — une boutique doit
   * pouvoir retrouver tout document déjà émis, qu'il vienne de la caisse
   * (PosSale) ou d'une commande Marketplace (ShopOrder), pour le réimprimer
   * ou simplement suivre son activité. On inclut directement le montant et la
   * devise de la vente liée pour éviter un aller-retour supplémentaire côté
   * écran.
   */
  async listForShop(shopId: string) {
    const documents = await this.prisma.commercialDocument.findMany({
      where: { shopId },
      include: {
        posSale: {
          select: {
            totalAmount: true,
            currency: true,
            customer: { select: { fullName: true } },
          },
        },
        shopOrder: {
          select: {
            subtotal: true,
            order: { select: { currency: true, buyer: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return documents.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      isFiscallyHomologated: d.isFiscallyHomologated,
      createdAt: d.createdAt,
      source: d.posSaleId ? ("CAISSE" as const) : d.shopOrderId ? ("MARKETPLACE" as const) : ("AUTRE" as const),
      amount: d.posSale ? Number(d.posSale.totalAmount) : d.shopOrder ? Number(d.shopOrder.subtotal) : null,
      currency: d.posSale?.currency ?? d.shopOrder?.order.currency ?? null,
      client: d.posSale?.customer?.fullName ?? d.shopOrder?.order.buyer.fullName ?? "Client comptoir",
    }));
  }

  async exporterExcel(shopId: string): Promise<Buffer> {
    const documents = await this.listForShop(shopId);
    const lignes = documents.map((d) => [
      d.number,
      LABELS_TYPE[d.type],
      d.source === "CAISSE" ? "Caisse" : d.source === "MARKETPLACE" ? "Marketplace" : "Autre",
      d.client ?? "",
      d.amount ?? "",
      d.currency ?? "",
      new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d.createdAt),
    ]);
    return construireClasseurExcel(
      "Ventes et factures",
      ["N° de document", "Type", "Origine", "Client", "Montant", "Devise", "Date"],
      lignes,
    );
  }

  /**
   * Rend un document commercial en PDF, imprimable directement (format
   * adapté imprimante de caisse, prompt §6). Produit à la demande plutôt que
   * stocké dans un stockage objet — aucun compte d'hébergement/stockage
   * n'existe encore (voir PROJECT_STATUS.md, section blocages), et imprimer
   * à la demande fonctionne même sans connexion internet au comptoir.
   */
  async renderPdf(shopId: string, documentId: string, host?: string) {
    const document = await this.prisma.commercialDocument.findFirst({
      where: { id: documentId, shopId },
      include: DOCUMENT_INCLUDE_POUR_PDF,
    });
    if (!document) {
      throw new NotFoundException("Document introuvable pour cette boutique.");
    }
    return this.rendrerDocumentCharge(document, host);
  }

  /**
   * Variante publique, sans authentification (12 nov. 2026, demande :
   * "donner la possibilité à la boutique de partager la facture... via
   * whatsapp"). L'identifiant du document (UUID v4, non énumérable) tient
   * lieu de jeton d'accès — même principe qu'un lien de partage "toute
   * personne disposant du lien" (facture Stripe, Google Docs, etc.).
   *
   * Historiquement restreinte aux documents liés à une commande Marketplace
   * (shopOrder) : un ticket de caisse (posSale) n'avait jusqu'ici aucun
   * client identifié à qui envoyer ce lien. Ouverte aussi aux tickets de
   * caisse le 19 nov. 2026 (demande explicite, après explication du
   * compromis de sécurité : "QR code vers le PDF en ligne... les deux") —
   * désormais nécessaire puisque le QR code imprimé sur CHAQUE document
   * (voir pdf-renderer.ts) doit pouvoir être scanné quel que soit le type de
   * document. Le jeton d'accès (UUID v4 non énumérable) reste la même
   * garantie de sécurité pour les deux types.
   */
  async renderPdfPublic(documentId: string, host?: string) {
    const document = await this.prisma.commercialDocument.findFirst({
      where: { id: documentId },
      include: DOCUMENT_INCLUDE_POUR_PDF,
    });
    if (!document) {
      throw new NotFoundException("Document introuvable.");
    }
    return this.rendrerDocumentCharge(document, host);
  }

  private async rendrerDocumentCharge(document: DocumentAvecRelationsPourPdf, host?: string) {
    // Lien public de vérification (19 nov. 2026) — construit depuis l'en-
    // tête Host de la requête qui a demandé ce PDF plutôt qu'une URL
    // d'environnement codée en dur : fonctionne quel que soit le domaine
    // réel (Railway ou domaine personnalisé), sans variable à maintenir.
    // `https://` en dur : la plateforme ne sert jamais ce document en clair.
    // Absent (host inconnu) => pas de QR plutôt qu'un lien inventé.
    const urlPublique = host ? `https://${host}/documents/public/${document.id}/pdf` : null;

    const [logo, parametresPlateforme, barcode, qrCode] = await Promise.all([
      this.recupererLogo(document.shop.invoiceLogoUrl),
      this.adminSettings.get(),
      this.genererCodeBarres(document.number),
      urlPublique ? this.genererQrCode(urlPublique) : Promise.resolve(null),
    ]);
    const identiteBoutique = {
      shopAddress: document.shop.invoiceAddress,
      shopPhone: document.shop.invoicePhone,
      shopLogo: logo,
      shopFooterNote: document.shop.invoiceFooterNote,
      platformWebsite: parametresPlateforme.website,
      platformSupportEmail: parametresPlateforme.supportEmail,
      platformSupportPhone: parametresPlateforme.supportPhone,
      // Présentation normalisée auto-déclarée (14 nov. 2026, voir
      // Shop.normalisationAutoDeclaree) — n'imprime le bloc d'identité
      // fiscale que si la boutique a elle-même activé ce réglage ; jamais
      // affiché par défaut, et jamais présenté comme une homologation DGI
      // confirmée (voir le texte rendu dans pdf-renderer.ts).
      normalisationAutoDeclaree: document.shop.normalisationAutoDeclaree,
      identiteFiscale: document.shop.normalisationAutoDeclaree
        ? {
            fiscalLegalName: document.shop.fiscalLegalName,
            fiscalLegalForm: document.shop.fiscalLegalForm,
            fiscalIdNumber: document.shop.fiscalIdNumber,
            fiscalAddress: document.shop.fiscalAddress,
            fiscalJurisdiction: document.shop.fiscalJurisdiction,
            fiscalRegime: document.shop.fiscalRegime,
            fiscalVatRegistered: document.shop.fiscalVatRegistered,
          }
        : null,
    };

    if (document.posSale) {
      return renderDocumentPdf({
        shopName: document.shop.name,
        documentTypeLabel: LABELS_TYPE[document.type],
        number: document.number,
        createdAt: document.createdAt,
        currency: document.posSale.currency,
        lines: document.posSale.lines.map((l) => ({
          label: l.label,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
        })),
        payments: document.posSale.payments.map((p) => ({
          method: LABELS_PAIEMENT[p.method] ?? p.method,
          amount: Number(p.amount),
        })),
        totalAmount: Number(document.posSale.totalAmount),
        isFiscallyHomologated: document.isFiscallyHomologated,
        customerName: document.posSale.customer?.fullName ?? null,
        customerPhone: document.posSale.customer?.phone ?? null,
        barcode,
        qrCode,
        ...identiteBoutique,
      });
    }

    if (document.shopOrder) {
      // Aucune intégration de paiement Marketplace n'est branchée encore
      // (décision #2) : on n'invente jamais un paiement confirmé — on
      // affiche une note expliquant que le règlement se fait à la livraison.
      return renderDocumentPdf({
        shopName: document.shop.name,
        documentTypeLabel: LABELS_TYPE[document.type],
        number: document.number,
        createdAt: document.createdAt,
        currency: document.shopOrder.order.currency,
        lines: document.shopOrder.lines.map((l) => ({
          label: [l.variant.product.name, l.variant.size, l.variant.color].filter(Boolean).join(" — "),
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
        })),
        noteReglement: "Paiement à la livraison (espèces ou mobile money) — commande Marketplace.",
        totalAmount: Number(document.shopOrder.subtotal),
        isFiscallyHomologated: document.isFiscallyHomologated,
        customerName: document.shopOrder.order.buyer.fullName ?? null,
        customerPhone: document.shopOrder.order.buyerWhatsapp ?? document.shopOrder.order.buyerPhone ?? null,
        barcode,
        qrCode,
        ...identiteBoutique,
      });
    }

    throw new BadRequestException(
      "Ce document n'est lié ni à une vente de caisse ni à une commande Marketplace.",
    );
  }

  /**
   * Récupère le logo d'une boutique pour l'imprimer sur ses documents.
   * Jamais bloquant pour la génération du PDF : toute erreur (URL absente,
   * serveur distant indisponible, fichier trop volumineux, délai dépassé)
   * retourne simplement `null` plutôt que de faire échouer tout le document.
   */
  /**
   * Code-barres (Code128) encodant le numéro du document (19 nov. 2026,
   * demande : "voir la possibilité d'un qr code/code barre") — usage interne
   * (douchette, pointage comptable, retours) : `document.number` est déjà
   * imprimé en clair sur le document, ce code ne fait qu'en faciliter la
   * relecture par scan. Jamais bloquant, comme `recupererLogo` ci-dessus.
   */
  private async genererCodeBarres(numero: string): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: "code128",
        text: numero,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: "center",
      });
    } catch (err) {
      this.logger.warn(`Génération du code-barres échouée pour le document ${numero} : ${err}`);
      return null;
    }
  }

  /**
   * QR code encodant le lien public de vérification du document (19 nov.
   * 2026, même demande que ci-dessus) — scan en personne depuis le document
   * imprimé, jamais transmis automatiquement nulle part (contrairement au
   * partage WhatsApp explicite déjà existant par ailleurs). Jamais bloquant.
   */
  private async genererQrCode(contenu: string): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: "qrcode",
        text: contenu,
        scale: 3,
      });
    } catch (err) {
      this.logger.warn(`Génération du QR code échouée pour "${contenu}" : ${err}`);
      return null;
    }
  }

  private async recupererLogo(url: string | null): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), 4000);
      const reponse = await fetch(url, { signal: controleur.signal });
      clearTimeout(minuteur);
      if (!reponse.ok) return null;
      const tailleDeclaree = Number(reponse.headers.get("content-length") ?? "0");
      if (tailleDeclaree > 3_000_000) return null; // garde-fou : 3 Mo max
      const tampon = Buffer.from(await reponse.arrayBuffer());
      if (tampon.byteLength > 3_000_000) return null;
      return tampon;
    } catch {
      return null;
    }
  }

  /**
   * Numérotation séquentielle par boutique et par type — basique mais
   * suffisant pour les documents non homologués. La numérotation exigée pour
   * INVOICE_FISCAL dépendra des spécifications techniques DGI, pas encore
   * obtenues (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).
   */
  private async nextNumber(shopId: string, type: DocumentType): Promise<string> {
    const count = await this.prisma.commercialDocument.count({ where: { shopId, type } });
    const prefix = type.slice(0, 3).toUpperCase();
    return `${prefix}-${shopId.slice(0, 8)}-${String(count + 1).padStart(6, "0")}`;
  }
}
