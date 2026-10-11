import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";

// TODO : brancher le guard JWT + vérifier que l'appelant appartient bien à `shopId`
// (voir le même TODO dans shops.controller.ts).
@Controller("shops/:shopId/products")
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
