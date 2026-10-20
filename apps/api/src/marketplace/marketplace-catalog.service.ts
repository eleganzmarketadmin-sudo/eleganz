import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SearchProductsDto } from "./dto/search-products.dto";

/**
 * Champs d'une variante sûrs à exposer publiquement (20 oct. 2026, correctif
 * d'audit de lancement). Avant ce correctif, `include: { variants: ... }`
 * sans `select` renvoyait TOUS les champs du modèle Prisma, y compris
 * `costPrice` (prix d'achat) et `coutMoyenPondere` (CUMP) — alors que
 * schema.prisma documente explicitement que `costPrice` ne doit "jamais
 * être exposé aux autres vendeurs", a fortiori pas au grand public. N'importe
 * quel visiteur pouvait lire la marge de chaque boutique dans la réponse
 * JSON brute du marketplace, même si l'écran ne l'affichait pas.
 */
const VARIANT_PUBLIC_SELECT = {
  id: true,
  sku: true,
  size: true,
  color: true,
  sellPrice: true,
  compareAtPrice: true,
  currency: true,
  stockQty: true,
} as const;

@Injectable()
export class MarketplaceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchProductsDto) {
    return this.prisma.product.findMany({
      where: {
        isPublished: true,
        shop: {
          isPubliclyListed: true,
          status: { in: ["FREE_PERIOD", "ACTIVE"] },
          // Filtre "livre chez moi" (prompt du 15 oct. 2026) — ne garde que
          // les boutiques ayant déclaré cette ville comme zone de livraison.
          ...(dto.cityId ? { deliveryZones: { some: { cityId: dto.cityId } } } : {}),
          // Filtre "page boutique publique" (prompt du 15 oct. 2026, point 6).
          ...(dto.shopSlug ? { slug: dto.shopSlug } : {}),
        },
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.q
          ? {
              OR: [
                { name: { contains: dto.q, mode: "insensitive" } },
                { description: { contains: dto.q, mode: "insensitive" } },
              ],
            }
          : {}),
        variants: {
          some: {
            stockQty: { gt: 0 },
            ...(dto.size ? { size: dto.size } : {}),
            ...(dto.color ? { color: dto.color } : {}),
            ...(dto.minPrice != null ? { sellPrice: { gte: dto.minPrice } } : {}),
            ...(dto.maxPrice != null ? { sellPrice: { lte: dto.maxPrice } } : {}),
          },
        },
      },
      include: {
        variants: { where: { stockQty: { gt: 0 } }, select: VARIANT_PUBLIC_SELECT },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            deliveryZones: { include: { country: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPublished(productId: string) {
    return this.prisma.product.findFirstOrThrow({
      where: { id: productId, isPublished: true, shop: { isPubliclyListed: true } },
      include: {
        variants: { select: VARIANT_PUBLIC_SELECT },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            deliveryZones: { include: { country: true, city: true } },
          },
        },
      },
    });
  }
}
