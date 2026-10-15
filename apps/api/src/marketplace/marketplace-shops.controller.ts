import { Controller, Get, Param, Query } from "@nestjs/common";
import { MarketplaceShopsService } from "./marketplace-shops.service";

// Pas de guard : navigation publique, comme marketplace-catalog.controller.ts.
// Attention à l'ordre des routes : "/marketplace/shops" (recherche) doit
// être déclarée avant "/marketplace/shops/:slug" dans la même classe pour
// que Nest ne confonde jamais un chemin vide avec un paramètre — ici elles
// sont de toute façon distinguées par leur segment, donc aucun risque.
@Controller("marketplace/shops")
export class MarketplaceShopsController {
  constructor(private readonly shops: MarketplaceShopsService) {}

  @Get()
  search(@Query("q") q?: string, @Query("cityId") cityId?: string) {
    return this.shops.search(q, cityId);
  }

  @Get(":slug")
  findBySlug(@Param("slug") slug: string) {
    return this.shops.findBySlug(slug);
  }
}
