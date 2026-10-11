import { Controller, Get, Param, Query } from "@nestjs/common";
import { MarketplaceCatalogService } from "./marketplace-catalog.service";
import { SearchProductsDto } from "./dto/search-products.dto";

// Pas de guard : navigation publique, comme sur fashionnova.com — tout
// acheteur, connecté ou non, peut parcourir le catalogue publié.
@Controller("marketplace/products")
export class MarketplaceCatalogController {
  constructor(private readonly catalogService: MarketplaceCatalogService) {}

  @Get()
  search(@Query() dto: SearchProductsDto) {
    return this.catalogService.search(dto);
  }

  @Get(":productId")
  findOne(@Param("productId") productId: string) {
    return this.catalogService.findPublished(productId);
  }
}
