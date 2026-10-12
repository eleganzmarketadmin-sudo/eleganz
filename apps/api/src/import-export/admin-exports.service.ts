import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { construireClasseurExcel } from "../common/xlsx.util";

const LABELS_STATUT_BOUTIQUE: Record<string, string> = {
  PENDING_VALIDATION: "En attente de validation",
  FREE_PERIOD: "Période gratuite",
  ACTIVE: "Active",
  PAYMENT_DUE: "Paiement dû",
  SUSPENDED: "Suspendue",
  CLOSED: "Fermée",
};

/**
 * Exports Excel pour le centre de pilotage admin (prompt du 12 oct. 2026) —
 * vue plateforme entière, à la différence des exports côté boutique
 * (ProductImportService, ShopExportsService) qui ne voient que leurs propres
 * données.
 */
@Injectable()
export class AdminExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exporterBoutiques(): Promise<Buffer> {
    const boutiques = await this.prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { fullName: true, email: true, phone: true } },
        _count: { select: { products: true, orders: true } },
      },
    });

    const lignes = boutiques.map((b) => [
      b.name,
      b.slug,
      b.mode,
      LABELS_STATUT_BOUTIQUE[b.status] ?? b.status,
      b.owner.fullName,
      b.owner.email ?? "",
      b.owner.phone ?? "",
      b._count.products,
      b._count.orders,
      b.isPubliclyListed ? "Oui" : "Non",
      new Intl.DateTimeFormat("fr-FR").format(b.createdAt),
    ]);

    return construireClasseurExcel(
      "Boutiques",
      [
        "Nom",
        "Slug",
        "Mode",
        "Statut",
        "Propriétaire",
        "Email",
        "Téléphone",
        "Articles",
        "Commandes",
        "Publiée sur la Marketplace",
        "Créée le",
      ],
      lignes,
    );
  }

  async exporterProduits(): Promise<Buffer> {
    const produits = await this.prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { name: true } }, variants: true },
    });

    const lignes: (string | number)[][] = [];
    for (const p of produits) {
      if (p.variants.length === 0) {
        lignes.push([p.shop.name, p.name, p.category ?? "", "", "", "", "", "", "", p.isPublished ? "Oui" : "Non"]);
        continue;
      }
      for (const v of p.variants) {
        lignes.push([
          p.shop.name,
          p.name,
          p.category ?? "",
          v.sku,
          [v.size, v.color].filter(Boolean).join(" / "),
          v.costPrice != null ? Number(v.costPrice) : "",
          Number(v.sellPrice),
          v.currency,
          v.stockQty,
          p.isPublished ? "Oui" : "Non",
        ]);
      }
    }

    return construireClasseurExcel(
      "Produits",
      [
        "Boutique",
        "Article",
        "Catégorie",
        "Référence",
        "Taille / couleur",
        "Prix d'achat",
        "Prix de vente",
        "Devise",
        "Stock",
        "Publié sur la Marketplace",
      ],
      lignes,
    );
  }

  async exporterCommandes(): Promise<Buffer> {
    const commandes = await this.prisma.shopOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { name: true } },
        order: { select: { buyer: { select: { fullName: true } }, buyerWhatsapp: true, buyerPhone: true, createdAt: true } },
      },
    });

    const lignes = commandes.map((c) => [
      c.id.slice(0, 8),
      c.shop.name,
      c.status,
      Number(c.subtotal),
      c.order.buyer.fullName,
      c.order.buyerWhatsapp ?? c.order.buyerPhone ?? "",
      new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(c.createdAt),
    ]);

    return construireClasseurExcel(
      "Commandes",
      ["N°", "Boutique", "Statut", "Sous-total", "Acheteur", "Contact", "Date"],
      lignes,
    );
  }

  async exporterFactures(): Promise<Buffer> {
    const factures = await this.prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { name: true } } },
    });

    const lignes = factures.map((f) => [
      f.shop.name,
      Number(f.amount),
      f.status,
      f.dueAt ? new Intl.DateTimeFormat("fr-FR").format(f.dueAt) : "",
      f.paidAt ? new Intl.DateTimeFormat("fr-FR").format(f.paidAt) : "",
      new Intl.DateTimeFormat("fr-FR").format(f.createdAt),
    ]);

    return construireClasseurExcel(
      "Factures plateforme",
      ["Boutique", "Montant", "Statut", "Échéance", "Payée le", "Émise le"],
      lignes,
    );
  }
}
