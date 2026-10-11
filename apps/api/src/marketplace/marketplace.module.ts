import { Module } from "@nestjs/common";
import { MarketplaceCatalogService } from "./marketplace-catalog.service";
import { MarketplaceCatalogController } from "./marketplace-catalog.controller";

// Côté lecture publique de la Marketplace : pas de guard, uniquement les
// produits dont isPublished=true et la boutique isPubliclyListed=true.
// À ne jamais réutiliser pour les routes de gestion (catalog.module.ts).
@Module({
  providers: [MarketplaceCatalogService],
  controllers: [MarketplaceCatalogController],
  exports: [MarketplaceCatalogService],
})
export class MarketplaceModule {}
