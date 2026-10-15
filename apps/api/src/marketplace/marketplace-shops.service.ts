import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Recherche et fiche publique des boutiques (prompt du 15 oct. 2026, points
 * 5 et 6 : lien de boutique partageable + recherche de boutiques à visiter).
 * Lecture publique, même convention que MarketplaceCatalogService : jamais
 * de guard, uniquement les boutiques isPubliclyListed=true et actives.
 */
@Injectable()
export class MarketplaceShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q?: string, cityId?: string) {
    const boutiques = await this.prisma.shop.findMany({
      where: {
        isPubliclyListed: true,
        status: { in: ["FREE_PERIOD", "ACTIVE"] },
        ...(cityId ? { deliveryZones: { some: { cityId } } } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        invoiceLogoUrl: true,
        deliveryZones: { include: { country: true, city: true } },
        _count: { select: { products: { where: { isPublished: true } } } },
      },
      orderBy: { name: "asc" },
    });

    // Note moyenne calculée à part (pas de agrégat direct pratique dans le
    // select ci-dessus) — un aller-retour groupé plutôt qu'une requête par
    // boutique.
    const notes = await this.prisma.review.groupBy({
      by: ["shopId"],
      where: { shopId: { in: boutiques.map((b) => b.id) }, isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const noteParBoutique = new Map(notes.map((n) => [n.shopId, n]));

    return boutiques.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: b.invoiceLogoUrl,
      deliveryZones: b.deliveryZones,
      nombreProduits: b._count.products,
      noteMoyenne: noteParBoutique.get(b.id)?._avg.rating ?? null,
      nombreAvis: noteParBoutique.get(b.id)?._count.rating ?? 0,
    }));
  }

  async findBySlug(slug: string) {
    const boutique = await this.prisma.shop.findFirst({
      where: { slug, isPubliclyListed: true },
      select: {
        id: true,
        name: true,
        slug: true,
        invoiceLogoUrl: true,
        deliveryZones: { include: { country: true, city: true } },
        _count: { select: { products: { where: { isPublished: true } } } },
      },
    });
    if (!boutique) {
      throw new NotFoundException("Boutique introuvable.");
    }
    const note = await this.prisma.review.aggregate({
      where: { shopId: boutique.id, isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      id: boutique.id,
      name: boutique.name,
      slug: boutique.slug,
      logoUrl: boutique.invoiceLogoUrl,
      deliveryZones: boutique.deliveryZones,
      nombreProduits: boutique._count.products,
      noteMoyenne: note._avg.rating,
      nombreAvis: note._count.rating,
    };
  }
}
