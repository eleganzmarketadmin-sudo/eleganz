import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto, UpdateVariantDto } from "./dto/create-variant.dto";
import { CreateVariantsBulkDto } from "./dto/create-variants-bulk.dto";
import { CreateVariantOptionDto } from "./dto/variant-option.dto";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateProductCategoryDto } from "./dto/product-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreatePriceTierDto } from "./dto/price-tier.dto";
import { RequestImageUploadDto } from "./dto/request-image-upload.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";

// Ce contrôleur est la vue "gestion" du catalogue (staff de la boutique
// uniquement). TODO (phase Marketplace) : ajouter un contrôleur public
// séparé, sans guard, qui ne retourne que les produits `isPublished: true` —
// ne jamais relâcher le guard ici pour servir les deux besoins à la fois.
@Controller("shops/:shopId/products")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.catalogService.listProducts(shopId);
  }

  @Post()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  create(@Param("shopId") shopId: string, @Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(shopId, dto);
  }

  @Patch(":productId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  update(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(shopId, productId, dto);
  }

  /**
   * Suppression d'un article entier (13 nov. 2026, signalement : "il n'y a
   * pas de possibilité/option de supprimer un produit"). Voir le
   * commentaire de CatalogService.deleteProduct pour le garde-fou : refusée
   * si au moins une variante a déjà été vendue, réceptionnée en stock, ou
   * si l'article a reçu un avis client.
   */
  @Delete(":productId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  deleteProduct(@Param("shopId") shopId: string, @Param("productId") productId: string) {
    return this.catalogService.deleteProduct(shopId, productId);
  }

  @Post(":productId/images/upload-url")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  creerUrlUploadImage(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: RequestImageUploadDto,
  ) {
    return this.catalogService.creerUrlUploadImage(shopId, productId, dto.contentType);
  }

  @Post(":productId/variants")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  addVariant(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalogService.addVariant(shopId, productId, dto);
  }

  /**
   * Création en lot (demande du 12 oct. 2026) : une variante par combinaison
   * taille × couleur sélectionnée dans les listes déroulantes de la
   * boutique, plutôt qu'une saisie manuelle répétée. Réservée au bouquet
   * "variantesProduits" (14 oct. 2026, plan commercial) — contrairement à
   * `addVariant` juste au-dessus, qui lui reste ouvert à tous les bouquets :
   * un produit n'a ni prix ni stock sans au moins une variante (schema.prisma,
   * `Product` n'a pas ces champs), donc bloquer la création de variante "simple"
   * casserait la vente pour le bouquet Starter plutôt que de restreindre une
   * fonctionnalité premium.
   */
  @Patch(":productId/variants/:variantId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  updateVariant(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.catalogService.updateVariant(shopId, productId, variantId, dto);
  }

  /**
   * Correction manuelle d'un écart de stock constaté (inventaire physique,
   * casse, erreur de saisie) — 20 oct. 2026. Jamais un PATCH direct sur
   * `stockQty` : voir le commentaire de `CatalogService.adjustStock`, cette
   * route reste le seul point d'entrée pour une correction manuelle, qui
   * enregistre toujours un StockMovement ADJUSTMENT traçable.
   */
  @Post(":productId/variants/:variantId/stock-adjustment")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  adjustStock(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.catalogService.adjustStock(shopId, productId, variantId, dto);
  }

  // Pas de @RequiresGestionFeature ici (corrigé 12 nov. 2026, retour client :
  // voir le commentaire de CatalogService.addVariantsBulk) — cette route sert
  // aussi bien la création "simple" (0 taille/0 couleur, ouverte à tous les
  // bouquets, seul moyen pour le front de donner un prix/stock à un produit)
  // que le vrai lot multi-combinaisons (réservé au bouquet "variantesProduits").
  // Le contrôle se fait donc dans le service, après avoir calculé le nombre
  // réel de combinaisons demandées, pas ici au niveau de la route entière.
  @Post(":productId/variants/bulk")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  addVariantsBulk(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantsBulkDto,
  ) {
    return this.catalogService.addVariantsBulk(shopId, productId, dto);
  }

  /**
   * Prix de gros par palier de quantité (2 nov. 2026, demande boutique :
   * "les options des prix en gros et les conditions, exemple à partir de 10
   * pièces"), géré ici comme une sous-ressource de la variante — même
   * principe que /variant-options pour taille/couleur : ajout/suppression
   * plutôt qu'un PATCH de tableau complet, pour éviter qu'un écran resté
   * ouvert longtemps n'écrase les paliers ajoutés entre-temps depuis un
   * autre onglet.
   */
  @Post(":productId/variants/:variantId/price-tiers")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  addPriceTier(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() dto: CreatePriceTierDto,
  ) {
    return this.catalogService.addPriceTier(shopId, productId, variantId, dto);
  }

  @Delete(":productId/variants/:variantId/price-tiers/:tierId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  removePriceTier(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Param("tierId") tierId: string,
  ) {
    return this.catalogService.removePriceTier(shopId, productId, variantId, tierId);
  }

  /**
   * Suppression d'une variante (13 nov. 2026, même signalement que
   * deleteProduct juste au-dessus). Voir le commentaire de
   * CatalogService.deleteVariant pour le garde-fou.
   */
  @Delete(":productId/variants/:variantId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  deleteVariant(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
  ) {
    return this.catalogService.deleteVariant(shopId, productId, variantId);
  }
}

/**
 * Listes déroulantes taille/couleur propres à chaque boutique — voir
 * VariantOption dans schema.prisma. Contrôleur séparé car indépendant d'un
 * produit précis (les valeurs sont partagées par tout le catalogue de la
 * boutique).
 */
@Controller("shops/:shopId/variant-options")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class VariantOptionsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.catalogService.listVariantOptions(shopId);
  }

  @Post()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  create(@Param("shopId") shopId: string, @Body() dto: CreateVariantOptionDto) {
    return this.catalogService.createVariantOption(shopId, dto);
  }

  @Delete(":optionId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  remove(@Param("shopId") shopId: string, @Param("optionId") optionId: string) {
    return this.catalogService.deleteVariantOption(shopId, optionId);
  }
}

/**
 * Référentiel global des catégories d'articles (16 oct. 2026) — partagé
 * entre toutes les boutiques, à l'inverse de /shops/:shopId/variant-options
 * qui reste propre à chaque boutique. La lecture est publique (nécessaire
 * au filtre catégorie du Marketplace, qui n'authentifie pas l'acheteur) ;
 * l'ajout exige d'être connecté (staff d'une boutique quelconque), sans
 * guard de boutique précise puisque la valeur n'appartient à aucune.
 */
@Controller("categories")
export class ProductCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.listProductCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProductCategoryDto) {
    return this.catalogService.createProductCategory(dto);
  }
}
