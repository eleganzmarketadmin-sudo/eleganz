import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { CreateVariantsBulkDto } from "./dto/create-variants-bulk.dto";
import { CreateVariantOptionDto } from "./dto/variant-option.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { RequestImageUploadDto } from "./dto/request-image-upload.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
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
  @Post(":productId/variants/bulk")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  @RequiresGestionFeature("variantesProduits")
  addVariantsBulk(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantsBulkDto,
  ) {
    return this.catalogService.addVariantsBulk(shopId, productId, dto);
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
