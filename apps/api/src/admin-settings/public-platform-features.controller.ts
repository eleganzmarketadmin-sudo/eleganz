import { Controller, Get } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";

/**
 * Lecture publique des interrupteurs de fonctionnalités IA (demande du
 * 12 oct. 2026) — Gestion et la Marketplace en ont besoin sans être
 * authentifiées en admin, pour savoir si "Recherche par photo" et "Studio
 * publicitaire IA" doivent s'afficher actifs ou "Bientôt disponible".
 * Jamais les coordonnées de contact ici, seulement ces deux booléens.
 */
@Controller("platform-settings")
export class PublicPlatformFeaturesController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get("features")
  features() {
    return this.adminSettingsService.publicFeatures();
  }

  // Tarification livreur, publique pour affichage à l'inscription (prompt
  // du 13 oct. 2026, point 1) — voir AdminSettingsService.publicDriverPricing.
  @Get("driver-pricing")
  driverPricing() {
    return this.adminSettingsService.publicDriverPricing();
  }

  @Get("comptable-pricing")
  comptablePricing() {
    return this.adminSettingsService.publicComptablePricing();
  }

  // Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) —
  // public, pour que Marketplace, Caisse et Mon Comptable affichent tous le
  // même équivalent sans être authentifiés en admin.
  @Get("exchange-rate")
  exchangeRate() {
    return this.adminSettingsService.publicExchangeRate();
  }
}
