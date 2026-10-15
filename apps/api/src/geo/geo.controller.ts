import { Controller, Get, Param } from "@nestjs/common";
import { GeoService } from "./geo.service";

// Pas de guard : les menus pays/villes sont lus aussi bien par un vendeur
// (réglage de ses zones de livraison) que par un acheteur non connecté
// (filtre de recherche Marketplace, fiche produit).
@Controller("geo")
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get("pays")
  listPays() {
    return this.geoService.listPays();
  }

  @Get("pays/:countryId/villes")
  listVilles(@Param("countryId") countryId: string) {
    return this.geoService.listVilles(countryId);
  }
}
