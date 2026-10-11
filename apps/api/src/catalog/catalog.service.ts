import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { StockMovementType } from "@eleganz/database";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  createProduct(shopId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        shopId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        images: dto.images ?? [],
      },
    });
  }

  /**
   * Met à jour les champs descriptifs d'un article, dont ses images — URLs
   * hébergées ailleurs tant qu'aucun compte de stockage objet n'existe
   * (PROJECT_STATUS.md). `where: { id: productId, shopId }` garantit qu'on
   * ne peut jamais modifier l'article d'une autre boutique même en devinant
   * un id.
   */
  async updateProduct(shopId: string, productId: string, dto: UpdateProductDto) {
    const produit = await this.prisma.product.findFirstOrThrow({ where: { id: productId, shopId } });
    return this.prisma.product.update({
      where: { id: produit.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
      },
      include: { variants: true },
    });
  }

  listProducts(shopId: string) {
    return this.prisma.product.findMany({
      where: { shopId },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Ajoute une variante et, si un stock initial est fourni, l'enregistre comme
   * un mouvement de stock traçable (pas un simple champ écrasé) — cohérent
   * avec le principe d'unicité du stock décrit dans ARCHITECTURE.md.
   */
  async addVariant(shopId: string, productId: string, dto: CreateVariantDto) {
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.create({
        data: {
          productId,
          sku: dto.sku,
          size: dto.size,
          color: dto.color,
          costPrice: dto.costPrice,
          sellPrice: dto.sellPrice,
          currency: dto.currency ?? "USD",
          stockQty: dto.initialStockQty ?? 0,
        },
      });

      if (dto.initialStockQty && dto.initialStockQty > 0) {
        await tx.stockMovement.create({
          data: {
            shopId,
            variantId: variant.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: dto.initialStockQty,
            reference: "stock_initial",
          },
        });
      }

      return variant;
    });
  }
}
