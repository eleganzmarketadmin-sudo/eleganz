import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
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
}
