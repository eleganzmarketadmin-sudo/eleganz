import { Controller, Get } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";

/**
 * Lecture publique des interrupteurs de fonctionnalités IA (demande du
 * 12 oct. 2026) — Gestion et la Marketplace en ont besoin sans être
 * authentifiées en admin, pour savoir si "Recherche par photo" et "Studio
 * publicitaire IA" doivent s'afficher actifs ou "Bientôt disponible".
 * Jamais les coordonnées de contact dans cette route précise, seulement ces
 * deux booléens — les coordonnées de contact ont leur propre route dédiée,
 * `contact()` ci-dessous.
 */
@Controller("platform-settings")
export class PublicPlatformFeaturesController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get("features")
  features() {
    return this.adminSettingsService.publicFeatures();
  }

  // Coordonnées de contact affichées dans le pied de page et la page "À
  // propos" (prompt du 13 oct. 2026, point 3) — mêmes valeurs que celles
  // gérées dans /admin/parametres, jamais dupliquées ni inventées côté écran.
  @Get("contact")
  contact() {
    return this.adminSettingsService.publicContactInfo();
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
