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
}
