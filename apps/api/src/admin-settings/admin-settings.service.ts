import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

const ID_SINGLETON = "platform";

/**
 * Coordonnées officielles de la plateforme (adresse, site web, contact,
 * réseaux sociaux) — une seule ligne en base, créée à la première lecture
 * si elle n'existe pas encore. Utilisées à la fois par le Centre de
 * pilotage (pour les modifier) et par la génération des documents
 * commerciaux (pour la signature ELEGANZ en bas de chaque facture/ticket).
 */
@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existant = await this.prisma.platformSettings.findUnique({ where: { id: ID_SINGLETON } });
    if (existant) return existant;
    return this.prisma.platformSettings.create({ data: { id: ID_SINGLETON } });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    await this.get(); // garantit que la ligne existe avant la mise à jour
    return this.prisma.platformSettings.update({
      where: { id: ID_SINGLETON },
      data: {
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.website !== undefined && { website: dto.website || null }),
        ...(dto.supportEmail !== undefined && { supportEmail: dto.supportEmail || null }),
        ...(dto.supportPhone !== undefined && { supportPhone: dto.supportPhone || null }),
        ...(dto.whatsappLink !== undefined && { whatsappLink: dto.whatsappLink || null }),
        ...(dto.telegramLink !== undefined && { telegramLink: dto.telegramLink || null }),
        ...(dto.tiktokUrl !== undefined && { tiktokUrl: dto.tiktokUrl || null }),
        ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl || null }),
        ...(dto.photoSearchEnabled !== undefined && { photoSearchEnabled: dto.photoSearchEnabled }),
        ...(dto.adStudioEnabled !== undefined && { adStudioEnabled: dto.adStudioEnabled }),
        ...(dto.driverOpeningFee !== undefined && { driverOpeningFee: dto.driverOpeningFee }),
        ...(dto.driverMonthlyFee !== undefined && { driverMonthlyFee: dto.driverMonthlyFee }),
        ...(dto.driverFreeMonths !== undefined && { driverFreeMonths: dto.driverFreeMonths }),
        ...(dto.comptableMonthlyFee !== undefined && { comptableMonthlyFee: dto.comptableMonthlyFee }),
        ...(dto.comptableYearlyFee !== undefined && { comptableYearlyFee: dto.comptableYearlyFee }),
        ...(dto.comptableFreeMonths !== undefined && { comptableFreeMonths: dto.comptableFreeMonths }),
      },
    });
  }

  /**
   * Lecture publique, sans authentification — juste les deux interrupteurs
   * de fonctionnalités IA, jamais les coordonnées de contact (réservées à
   * l'admin). Permet à Gestion et à la Marketplace d'afficher "Bientôt
   * disponible" ou le vrai bouton selon ce que l'admin a activé.
   */
  async publicFeatures() {
    const settings = await this.get();
    return {
      photoSearchEnabled: settings.photoSearchEnabled,
      adStudioEnabled: settings.adStudioEnabled,
    };
  }

  /**
   * Lecture publique de la tarification livreur (prompt du 13 oct. 2026,
   * point 1) — affichée sur l'écran d'inscription livreur pour la
   * transparence, sans authentification. Jamais les coordonnées de contact
   * ni rien d'autre ici, seulement ces trois valeurs.
   */
  async publicDriverPricing() {
    const settings = await this.get();
    return {
      driverOpeningFee: settings.driverOpeningFee,
      driverMonthlyFee: settings.driverMonthlyFee,
      driverFreeMonths: settings.driverFreeMonths,
    };
  }

  /** Lecture publique de la tarification Mon Comptable (prompt §14) — même logique que publicDriverPricing. */
  async publicComptablePricing() {
    const settings = await this.get();
    return {
      comptableMonthlyFee: settings.comptableMonthlyFee,
      comptableYearlyFee: settings.comptableYearlyFee,
      comptableFreeMonths: settings.comptableFreeMonths,
    };
  }

  /**
   * Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) — un
   * champ dédié plutôt que de passer par update() générique, car chaque
   * changement doit aussi écrire une ligne d'historique (ExchangeRateHistory),
   * jamais juste écraser la valeur précédente.
   */
  async updateExchangeRate(cdfPerUsd: number, setByUserId?: string) {
    await this.get();
    const [settings] = await this.prisma.$transaction([
      this.prisma.platformSettings.update({
        where: { id: ID_SINGLETON },
        data: { cdfPerUsd, exchangeRateUpdatedAt: new Date() },
      }),
      this.prisma.exchangeRateHistory.create({
        data: { cdfPerUsd, setByUserId },
      }),
    ]);
    return settings;
  }

  /** Les 50 derniers changements de taux, les plus récents d'abord — pour l'écran admin. */
  async exchangeRateHistory() {
    return this.prisma.exchangeRateHistory.findMany({
      orderBy: { setAt: "desc" },
      take: 50,
    });
  }

  /**
   * Lecture publique du taux de change (prompt du 13 oct. 2026, point 5) —
   * sans authentification, pour que Marketplace, Caisse et Mon Comptable
   * puissent tous afficher les équivalents de devise. `cdfPerUsd` est `null`
   * tant qu'aucun admin ne l'a configuré : l'appelant doit alors simplement
   * ne rien convertir, jamais supposer une valeur par défaut.
   */
  async publicExchangeRate() {
    const settings = await this.get();
    return {
      cdfPerUsd: settings.cdfPerUsd,
      updatedAt: settings.exchangeRateUpdatedAt,
    };
  }
}
