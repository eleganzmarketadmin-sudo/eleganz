import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";

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
  create(@Param("shopId") shopId: string, @Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(shopId, dto);
  }

  @Post(":productId/variants")
  addVariant(
    @Param("shopId") shopId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalogService.addVariant(shopId, productId, dto);
  }
}
