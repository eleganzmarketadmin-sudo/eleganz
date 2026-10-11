import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SearchProductsDto } from "./dto/search-products.dto";

@Injectable()
export class MarketplaceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchProductsDto) {
    return this.prisma.product.findMany({
      where: {
        isPublished: true,
        shop: { isPubliclyListed: true, status: { in: ["FREE_PERIOD", "ACTIVE"] } },
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
        variants: { where: { stockQty: { gt: 0 } } },
        shop: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPublished(productId: string) {
    return this.prisma.product.findFirstOrThrow({
      where: { id: productId, isPublished: true, shop: { isPubliclyListed: true } },
      include: { variants: true, shop: { select: { id: true, name: true, slug: true } } },
    });
  }
}
