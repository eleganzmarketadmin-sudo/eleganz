import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentType } from "@eleganz/database";
import { renderDocumentPdf } from "./pdf-renderer";
import { construireClasseurExcel } from "../common/xlsx.util";

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

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un document commercial lié à une vente de caisse. N'émet jamais
   * INVOICE_FISCAL — voir docs/COMPLIANCE_FACTURE_NORMALISEE.md pour la
   * procédure à suivre avant d'activer ce type, une fois l'homologation DGI
   * obtenue (décision #9 : les deux versions seront proposées au choix,
   * mais seule la version non homologuée est automatisée pour l'instant).
   */
  async generateForPosSale(shopId: string, posSaleId: string, type: DocumentType) {
    if (!NON_HOMOLOGATED_TYPES.includes(type)) {
      throw new BadRequestException(
        `${type} ne peut pas être généré automatiquement tant que l'homologation DGI n'est pas confirmée (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).`,
      );
    }

    const number = await this.nextNumber(shopId, type);

    return this.prisma.commercialDocument.create({
      data: {
        shopId,
        posSaleId,
        type,
        number,
        isFiscallyHomologated: false,
      },
    });
  }

  /**
   * Génère un document commercial lié à une sous-commande Marketplace reçue
   * par la boutique (`ShopOrder`, pas `PosSale`). Même garde-fou qu'en
   * caisse : jamais INVOICE_FISCAL par ce chemin.
   */
  async generateForShopOrder(shopId: string, shopOrderId: string, type: DocumentType) {
    if (!NON_HOMOLOGATED_TYPES.includes(type)) {
      throw new BadRequestException(
        `${type} ne peut pas être généré automatiquement tant que l'homologation DGI n'est pas confirmée (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).`,
      );
    }

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
        isFiscallyHomologated: false,
      },
    });
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
  async renderPdf(shopId: string, documentId: string) {
    const document = await this.prisma.commercialDocument.findFirst({
      where: { id: documentId, shopId },
      include: {
        shop: {
          select: {
            name: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceLogoUrl: true,
            invoiceFooterNote: true,
          },
        },
        posSale: { include: { lines: true, payments: true } },
        shopOrder: {
          include: {
            lines: { include: { variant: { include: { product: true } } } },
            order: { select: { currency: true } },
          },
        },
      },
    });
    if (!document) {
      throw new NotFoundException("Document introuvable pour cette boutique.");
    }

    const logo = await this.recupererLogo(document.shop.invoiceLogoUrl);
    const identiteBoutique = {
      shopAddress: document.shop.invoiceAddress,
      shopPhone: document.shop.invoicePhone,
      shopLogo: logo,
      shopFooterNote: document.shop.invoiceFooterNote,
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
