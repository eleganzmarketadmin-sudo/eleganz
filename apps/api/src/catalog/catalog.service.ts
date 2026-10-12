import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { CreateVariantsBulkDto } from "./dto/create-variants-bulk.dto";
import { CreateVariantOptionDto } from "./dto/variant-option.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { StockMovementType, VariantOptionKind } from "@eleganz/database";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Étape 1 de l'upload réel d'image (remplace le simple collage d'URL) :
   * vérifie que l'article appartient bien à cette boutique, puis renvoie une
   * URL signée R2 où le navigateur enverra directement le fichier, ainsi que
   * l'URL publique définitive à ajouter ensuite à `Product.images` via
   * `updateProduct`.
   */
  async creerUrlUploadImage(shopId: string, productId: string, contentType: string) {
    await this.prisma.product.findFirstOrThrow({ where: { id: productId, shopId } });
    return this.storage.creerUrlUploadImage(shopId, productId, contentType);
  }

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

  /**
   * Liste déroulante de la boutique pour un type (taille/couleur) — voir
   * VariantOption dans schema.prisma. Triée alphabétiquement pour un
   * affichage stable dans la liste déroulante.
   */
  async listVariantOptions(shopId: string) {
    const options = await this.prisma.variantOption.findMany({
      where: { shopId },
      orderBy: { value: "asc" },
    });
    return {
      sizes: options.filter((o) => o.kind === VariantOptionKind.SIZE).map((o) => o.value),
      colors: options.filter((o) => o.kind === VariantOptionKind.COLOR).map((o) => o.value),
    };
  }

  async createVariantOption(shopId: string, dto: CreateVariantOptionDto) {
    const valeur = dto.value.trim();
    try {
      await this.prisma.variantOption.create({
        data: { shopId, kind: dto.kind, value: valeur },
      });
    } catch (err: any) {
      // Déjà présente (contrainte @@unique) : idempotent, pas une erreur pour
      // l'utilisateur — il ajoute la même valeur depuis deux écrans ouverts.
      if (err?.code !== "P2002") throw err;
    }
    return this.listVariantOptions(shopId);
  }

  async deleteVariantOption(shopId: string, optionId: string) {
    await this.prisma.variantOption.deleteMany({ where: { id: optionId, shopId } });
    return this.listVariantOptions(shopId);
  }

  /**
   * Génère une variante par combinaison taille × couleur sélectionnée
   * (demande du 12 oct. 2026) — remplace la ressaisie manuelle répétée d'un
   * même article en plusieurs tailles/couleurs. `skuBase` est complété avec
   * un suffixe par combinaison pour garantir l'unicité (contrainte
   * `Variant.sku @unique`) ; si une combinaison est déjà prise, l'ensemble de
   * l'opération échoue (transaction) plutôt que de créer un lot partiel.
   */
  async addVariantsBulk(shopId: string, productId: string, dto: CreateVariantsBulkDto) {
    await this.prisma.product.findFirstOrThrow({ where: { id: productId, shopId } });

    const tailles = dto.sizes?.length ? dto.sizes : [null];
    const couleurs = dto.colors?.length ? dto.colors : [null];
    const combinaisons: { size: string | null; color: string | null }[] = [];
    for (const taille of tailles) {
      for (const couleur of couleurs) {
        combinaisons.push({ size: taille, color: couleur });
      }
    }
    if (combinaisons.length === 0) {
      throw new BadRequestException("Aucune combinaison taille/couleur à créer.");
    }
    if (combinaisons.length > 200) {
      throw new BadRequestException(
        "Trop de combinaisons à la fois (200 maximum) — réduisez la sélection.",
      );
    }

    const slug = (texte: string) =>
      texte
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    return this.prisma.$transaction(async (tx) => {
      const variantesCreees = [];
      for (const combo of combinaisons) {
        const suffixe = [combo.size, combo.color].filter(Boolean).map(slug).join("-");
        const sku = suffixe ? `${dto.skuBase}-${suffixe}` : dto.skuBase;

        const existante = await tx.variant.findUnique({ where: { sku } });
        if (existante) {
          throw new ConflictException(
            `Le SKU "${sku}" existe déjà — modifiez le préfixe ou la sélection.`,
          );
        }

        const variant = await tx.variant.create({
          data: {
            productId,
            sku,
            size: combo.size,
            color: combo.color,
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

        variantesCreees.push(variant);
      }
      return variantesCreees;
    });
  }
}
