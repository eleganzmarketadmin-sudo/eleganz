import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto, UpdateVariantDto } from "./dto/create-variant.dto";
import { CreateVariantsBulkDto } from "./dto/create-variants-bulk.dto";
import { CreateVariantOptionDto } from "./dto/variant-option.dto";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateProductCategoryDto } from "./dto/product-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { StockMovementType, VariantOptionKind } from "@eleganz/database";
import { StorageService } from "../storage/storage.service";

/**
 * Catégories majeures proposées à la création de l'API (16 oct. 2026) — un
 * point de départ raisonnable pour un marché généraliste à forte dominante
 * mode/habillement (cohérent avec les variantes taille/couleur déjà en
 * place). Chaque boutique peut en ajouter d'autres depuis l'écran
 * catalogue ; cette liste ne sert qu'à amorcer le référentiel partagé s'il
 * est encore vide, jamais à l'écraser ensuite.
 */
const CATEGORIES_PAR_DEFAUT = [
  "Mode femme",
  "Mode homme",
  "Mode enfant",
  "Chaussures",
  "Sacs & Maroquinerie",
  "Bijoux & Accessoires",
  "Beauté & Cosmétiques",
  "Électronique & Téléphonie",
  "Maison & Décoration",
  "Alimentation & Boissons",
  "Sport & Loisirs",
  "Autre",
];

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Amorce le référentiel ProductCategory s'il est encore vide (premier
   * déploiement après la migration, ou base neuve). Idempotent : ne fait
   * rien si des catégories existent déjà, pour ne jamais écraser des
   * valeurs renommées ou ajoutées entre-temps.
   */
  async onModuleInit() {
    try {
      const nombre = await this.prisma.productCategory.count();
      if (nombre > 0) return;
      await this.prisma.productCategory.createMany({
        data: CATEGORIES_PAR_DEFAUT.map((name, index) => ({ name, order: index })),
        skipDuplicates: true,
      });
      this.logger.log(`Référentiel de catégories amorcé (${CATEGORIES_PAR_DEFAUT.length} valeurs par défaut).`);
    } catch (err) {
      // Non bloquant pour le démarrage de l'API — au pire la liste reste
      // vide et les boutiques peuvent encore en ajouter manuellement.
      this.logger.error("Amorçage du référentiel de catégories échoué", err as Error);
    }
  }

  /**
   * Référentiel global des catégories (voir ProductCategory dans
   * schema.prisma) — partagé entre toutes les boutiques, à l'inverse de
   * `listVariantOptions` qui reste propre à chaque boutique.
   */
  listProductCategories() {
    return this.prisma.productCategory.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  async createProductCategory(dto: CreateProductCategoryDto) {
    const nom = dto.name.trim();
    try {
      await this.prisma.productCategory.create({ data: { name: nom } });
    } catch (err: any) {
      // Déjà présente (contrainte @@unique) : idempotent, pas une erreur —
      // une boutique peut proposer une catégorie qu'une autre a déjà créée.
      if (err?.code !== "P2002") throw err;
    }
    return this.listProductCategories();
  }

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

  /**
   * Limite de catalogue du bouquet ELEGANZ Gestion de la boutique (14 oct.
   * 2026, plan commercial — docs/PLAN_COMMERCIAL.md). `Product` n'a pas de
   * notion d'actif/archivé (seulement `isPublished`, qui ne concerne que la
   * visibilité Marketplace), donc "produits actifs max" se traduit par un
   * simple comptage de toutes les lignes `Product` de la boutique.
   * `maxActiveProducts` à `null` = illimité (bouquet Premium).
   */
  async createProduct(shopId: string, dto: CreateProductDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { gestionBouquet: { select: { name: true, maxActiveProducts: true } } },
    });
    const maxProduits = shop?.gestionBouquet?.maxActiveProducts;
    if (typeof maxProduits === "number") {
      const nombreActuel = await this.prisma.product.count({ where: { shopId } });
      if (nombreActuel >= maxProduits) {
        throw new ConflictException(
          `Le bouquet ${shop?.gestionBouquet?.name ?? "actuel"} de cette boutique est limité à ${maxProduits} produit(s). Passez à un bouquet supérieur depuis le Centre de pilotage pour en ajouter.`,
        );
      }
    }

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
    // Même principe que updateVariant (incident du 20 oct. 2026) : un prix
    // barré invalide à la création doit être signalé, jamais ignoré en
    // silence.
    if (dto.compareAtPrice != null && dto.compareAtPrice <= dto.sellPrice) {
      throw new BadRequestException(
        `Le prix barré (${dto.compareAtPrice}) doit être strictement supérieur au prix de vente (${dto.sellPrice}).`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.create({
        data: {
          productId,
          sku: dto.sku,
          size: dto.size,
          color: dto.color,
          costPrice: dto.costPrice,
          sellPrice: dto.sellPrice,
          compareAtPrice: dto.compareAtPrice ?? null,
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
   * Modification d'une variante existante. Étendue le 20 oct. 2026 (demande :
   * "les différents champs dans catalogue dès que saisie on ne peut pas les
   * modifier") — référence, taille, couleur et prix d'achat sont désormais
   * modifiables après coup, comme le prix de vente et la promotion (19 oct.
   * 2026) : plus besoin de supprimer puis recréer une variante mal saisie.
   * `productId` scope la variante à la bonne boutique via la relation
   * (jamais par variantId seul, pour empêcher qu'une boutique modifie la
   * variante d'une autre).
   */
  async updateVariant(shopId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
    const variante = await this.prisma.variant.findFirstOrThrow({
      where: { id: variantId, productId, product: { shopId } },
    });
    const nouveauSellPrice = dto.sellPrice ?? Number(variante.sellPrice);

    // Le prix barré effectif après cette requête : la valeur explicitement
    // envoyée, sinon celle déjà en base. Un simple changement de prix de
    // vente (sans toucher à la promo) ne doit jamais rendre un prix barré
    // existant incohérent en silence — même principe que l'incident du 20
    // oct. 2026 sur la promotion elle-même : toujours une erreur explicite,
    // jamais un état invalide enregistré sans avertissement.
    const compareAtPriceExplicite = dto.compareAtPrice !== undefined;
    const compareAtPriceEffectif = compareAtPriceExplicite
      ? dto.compareAtPrice
      : variante.compareAtPrice != null
        ? Number(variante.compareAtPrice)
        : null;

    if (compareAtPriceEffectif != null && compareAtPriceEffectif <= nouveauSellPrice) {
      if (compareAtPriceExplicite) {
        throw new BadRequestException(
          `Le prix barré (${dto.compareAtPrice}) doit être strictement supérieur au prix de vente (${nouveauSellPrice}).`,
        );
      }
      throw new BadRequestException(
        `Ce prix de vente (${nouveauSellPrice}) est supérieur ou égal au prix barré de la promotion en cours (${compareAtPriceEffectif}). Retirez d'abord la promotion avant de changer le prix de vente.`,
      );
    }

    if (dto.sku !== undefined && dto.sku !== variante.sku) {
      const existante = await this.prisma.variant.findUnique({ where: { sku: dto.sku } });
      if (existante) {
        throw new ConflictException(`La référence "${dto.sku}" est déjà utilisée par une autre variante.`);
      }
    }

    return this.prisma.variant.update({
      where: { id: variantId },
      data: {
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.size !== undefined ? { size: dto.size } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
        ...(dto.sellPrice !== undefined ? { sellPrice: dto.sellPrice } : {}),
        ...(compareAtPriceExplicite ? { compareAtPrice: dto.compareAtPrice } : {}),
      },
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
        const suffixe = [combo.size, combo.color]
          .filter((v): v is string => v != null && v !== "")
          .map(slug)
          .join("-");
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

  /**
   * Ajustement manuel du stock (20 oct. 2026 — suite de la demande "le
   * champ stock n'est toujours pas éditable"). `stockQty` n'est volontairement
   * pas un champ libre comme sku/prix : chaque vente, retour ou réception
   * l'actualise déjà en même temps qu'un StockMovement traçable, et la
   * valorisation CUMP (coutMoyenPondere) dépend de cette cohérence. Un
   * PATCH brut sur `stockQty` romprait cette traçabilité et pourrait
   * écraser une vente concurrente. Cette méthode reste donc le seul point
   * d'entrée pour une correction manuelle (inventaire physique, casse,
   * erreur de saisie) : elle calcule l'écart elle-même et l'enregistre
   * comme un mouvement ADJUSTMENT avec un motif, exactement comme le stock
   * initial à la création d'une variante.
   */
  async adjustStock(shopId: string, productId: string, variantId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      const variante = await tx.variant.findFirstOrThrow({
        where: { id: variantId, productId, product: { shopId } },
      });
      const ecart = dto.newQty - variante.stockQty;
      if (ecart === 0) return variante;

      const misAJour = await tx.variant.update({
        where: { id: variantId },
        data: { stockQty: dto.newQty },
      });

      await tx.stockMovement.create({
        data: {
          shopId,
          variantId,
          type: StockMovementType.ADJUSTMENT,
          quantity: ecart,
          reference: dto.reason?.trim() || "ajustement_manuel",
        },
      });

      return misAJour;
    });
  }
}
