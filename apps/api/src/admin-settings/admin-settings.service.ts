import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { recupererLogoDepuisUrl } from "../common/logo-fetch.util";
import type { IdentitePourPdf } from "../finance/dossier-credit-pdf-shared";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { validerSeuilsCroissants } from "../billing/dunning.util";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get() {
    const existant = await this.prisma.platformSettings.findUnique({ where: { id: ID_SINGLETON } });
    if (existant) return existant;
    return this.prisma.platformSettings.create({ data: { id: ID_SINGLETON } });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    const actuels = await this.get(); // garantit que la ligne existe avant la mise à jour

    // Validation des seuils de relance (16 nov. 2026, chantier relances/
    // recouvrement) : on ne valide que si AU MOINS un des 5 seuils est
    // envoyé dans cette requête — superpose le reste des seuils actuels en
    // base pour vérifier la cohérence du jeu complet, pas seulement des
    // champs envoyés isolément (un admin pourrait n'envoyer que
    // suspensionDayOffset et le faire passer sous warningDayOffset actuel).
    const unSeuilEnvoye =
      dto.reminderDay1Offset !== undefined ||
      dto.reminderDay2Offset !== undefined ||
      dto.reminderDay3Offset !== undefined ||
      dto.warningDayOffset !== undefined ||
      dto.suspensionDayOffset !== undefined;
    if (unSeuilEnvoye) {
      const erreur = validerSeuilsCroissants({
        invoiceLatePenaltyRatePercent: actuels.invoiceLatePenaltyRatePercent,
        invoicePenaltyGraceDays: actuels.invoicePenaltyGraceDays,
        reminderDay1Offset: dto.reminderDay1Offset ?? actuels.reminderDay1Offset,
        reminderDay2Offset: dto.reminderDay2Offset ?? actuels.reminderDay2Offset,
        reminderDay3Offset: dto.reminderDay3Offset ?? actuels.reminderDay3Offset,
        warningDayOffset: dto.warningDayOffset ?? actuels.warningDayOffset,
        suspensionDayOffset: dto.suspensionDayOffset ?? actuels.suspensionDayOffset,
      });
      if (erreur) throw new BadRequestException(erreur);
    }

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
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl || null }),
        ...(dto.headerNote !== undefined && { headerNote: dto.headerNote || null }),
        ...(dto.footerNote !== undefined && { footerNote: dto.footerNote || null }),
        ...(dto.photoSearchEnabled !== undefined && { photoSearchEnabled: dto.photoSearchEnabled }),
        ...(dto.adStudioEnabled !== undefined && { adStudioEnabled: dto.adStudioEnabled }),
        ...(dto.paiementEchelonneActivePlateforme !== undefined && {
          paiementEchelonneActivePlateforme: dto.paiementEchelonneActivePlateforme,
        }),
        ...(dto.boostPlafondSponsoriseResultatsPct !== undefined && {
          boostPlafondSponsoriseResultatsPct: dto.boostPlafondSponsoriseResultatsPct,
        }),
        ...(dto.boostCreditLancementNouvelleBoutiqueUSD !== undefined && {
          boostCreditLancementNouvelleBoutiqueUSD: dto.boostCreditLancementNouvelleBoutiqueUSD,
        }),
        ...(dto.boostRemisePremierBoostPct !== undefined && {
          boostRemisePremierBoostPct: dto.boostRemisePremierBoostPct,
        }),
        ...(dto.boostRemisePremierBoostPlafondUSD !== undefined && {
          boostRemisePremierBoostPlafondUSD: dto.boostRemisePremierBoostPlafondUSD,
        }),
        ...(dto.boostTauxChargesDirectesPct !== undefined && {
          boostTauxChargesDirectesPct: dto.boostTauxChargesDirectesPct,
        }),
        ...(dto.driverOpeningFee !== undefined && { driverOpeningFee: dto.driverOpeningFee }),
        ...(dto.driverMonthlyFee !== undefined && { driverMonthlyFee: dto.driverMonthlyFee }),
        ...(dto.driverFreeMonths !== undefined && { driverFreeMonths: dto.driverFreeMonths }),
        ...(dto.comptableMonthlyFee !== undefined && { comptableMonthlyFee: dto.comptableMonthlyFee }),
        ...(dto.comptableYearlyFee !== undefined && { comptableYearlyFee: dto.comptableYearlyFee }),
        ...(dto.comptableFreeMonths !== undefined && { comptableFreeMonths: dto.comptableFreeMonths }),
        ...(dto.marketplaceCommissionRateDefault !== undefined && {
          marketplaceCommissionRateDefault: dto.marketplaceCommissionRateDefault,
        }),
        ...(dto.marketplaceCommissionFreeMonths !== undefined && {
          marketplaceCommissionFreeMonths: dto.marketplaceCommissionFreeMonths,
        }),
        ...(dto.marketplaceCommissionMinAmount !== undefined && {
          marketplaceCommissionMinAmount: dto.marketplaceCommissionMinAmount,
        }),
        ...(dto.institutionLoanCommissionRateDefault !== undefined && {
          institutionLoanCommissionRateDefault: dto.institutionLoanCommissionRateDefault,
        }),
        ...(dto.institutionLoanCommissionMinAmount !== undefined && {
          institutionLoanCommissionMinAmount: dto.institutionLoanCommissionMinAmount,
        }),
        ...(dto.institutionLoanCommissionMaxAmount !== undefined && {
          institutionLoanCommissionMaxAmount: dto.institutionLoanCommissionMaxAmount,
        }),
        ...(dto.aiCreditUnitPrice !== undefined && { aiCreditUnitPrice: dto.aiCreditUnitPrice }),
        ...(dto.smsWhatsappPremiumEnabled !== undefined && {
          smsWhatsappPremiumEnabled: dto.smsWhatsappPremiumEnabled,
        }),
        ...(dto.smsWhatsappPremiumMonthlyFee !== undefined && {
          smsWhatsappPremiumMonthlyFee: dto.smsWhatsappPremiumMonthlyFee,
        }),
        ...(dto.notificationsInAppEnabled !== undefined && {
          notificationsInAppEnabled: dto.notificationsInAppEnabled,
        }),
        ...(dto.notificationsEmailEnabled !== undefined && {
          notificationsEmailEnabled: dto.notificationsEmailEnabled,
        }),
        ...(dto.notificationsSmsEnabled !== undefined && {
          notificationsSmsEnabled: dto.notificationsSmsEnabled,
        }),
        ...(dto.chatWidgetEnabled !== undefined && { chatWidgetEnabled: dto.chatWidgetEnabled }),
        ...(dto.platformFiscalLegalName !== undefined && { platformFiscalLegalName: dto.platformFiscalLegalName || null }),
        ...(dto.platformFiscalIdNumber !== undefined && { platformFiscalIdNumber: dto.platformFiscalIdNumber || null }),
        ...(dto.platformFiscalRccm !== undefined && { platformFiscalRccm: dto.platformFiscalRccm || null }),
        ...(dto.platformFiscalAddress !== undefined && { platformFiscalAddress: dto.platformFiscalAddress || null }),
        ...(dto.platformFiscalRegime !== undefined && { platformFiscalRegime: dto.platformFiscalRegime || null }),
        ...(dto.platformFoundedAt !== undefined && { platformFoundedAt: dto.platformFoundedAt ? new Date(dto.platformFoundedAt) : null }),
        ...(dto.invoiceLatePenaltyRatePercent !== undefined && {
          invoiceLatePenaltyRatePercent: dto.invoiceLatePenaltyRatePercent,
        }),
        ...(dto.invoicePenaltyGraceDays !== undefined && { invoicePenaltyGraceDays: dto.invoicePenaltyGraceDays }),
        ...(dto.reminderDay1Offset !== undefined && { reminderDay1Offset: dto.reminderDay1Offset }),
        ...(dto.reminderDay2Offset !== undefined && { reminderDay2Offset: dto.reminderDay2Offset }),
        ...(dto.reminderDay3Offset !== undefined && { reminderDay3Offset: dto.reminderDay3Offset }),
        ...(dto.warningDayOffset !== undefined && { warningDayOffset: dto.warningDayOffset }),
        ...(dto.suspensionDayOffset !== undefined && { suspensionDayOffset: dto.suspensionDayOffset }),
        ...(dto.notificationsWhatsappEnabled !== undefined && {
          notificationsWhatsappEnabled: dto.notificationsWhatsappEnabled,
        }),
        ...(dto.defaultDisplayCurrency !== undefined && { defaultDisplayCurrency: dto.defaultDisplayCurrency }),
      },
    });
  }

  /**
   * Lecture publique des seuils de relance/pénalité (16 nov. 2026) — pas de
   * données sensibles, utile pour qu'un écran self-service (boutique,
   * livreur, comptable) explique à l'avance le calendrier de relance sans
   * passer par l'API admin.
   */
  async publicDunningSettings() {
    const settings = await this.get();
    return {
      invoiceLatePenaltyRatePercent: settings.invoiceLatePenaltyRatePercent,
      invoicePenaltyGraceDays: settings.invoicePenaltyGraceDays,
      reminderDay1Offset: settings.reminderDay1Offset,
      reminderDay2Offset: settings.reminderDay2Offset,
      reminderDay3Offset: settings.reminderDay3Offset,
      warningDayOffset: settings.warningDayOffset,
      suspensionDayOffset: settings.suspensionDayOffset,
    };
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
      chatWidgetEnabled: settings.chatWidgetEnabled,
      // Paiement échelonné (26 nov. 2026) — interrupteur global lu
      // publiquement par le panier/la commande Marketplace, pour savoir si
      // l'option peut être proposée même quand l'article concerné l'a
      // activée côté boutique (voir Product.paiementEchelonneActif).
      paiementEchelonneActivePlateforme: settings.paiementEchelonneActivePlateforme,
    };
  }

  /**
   * Coordonnées officielles ELEGANZ (demande du 13 oct. 2026, point 3 —
   * "prévoir les champs contact et nos infos qui seront liés aux infos de
   * la plateforme gérée dans le Centre de pilotage") — lecture publique,
   * sans authentification, pour que le pied de page (tous les espaces) et
   * la page "À propos" affichent les vraies coordonnées éditées par l'admin
   * dans /admin/parametres, jamais une adresse ou un contact inventés.
   * Chaque champ est optionnel : un champ non renseigné est simplement
   * omis à l'affichage plutôt que de montrer une valeur vide ou un espace
   * réservé.
   */
  async publicContactInfo() {
    const settings = await this.get();
    return {
      address: settings.address,
      website: settings.website,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      whatsappLink: settings.whatsappLink,
      telegramLink: settings.telegramLink,
      tiktokUrl: settings.tiktokUrl,
      instagramUrl: settings.instagramUrl,
    };
  }

  // URL signée d'upload direct du logo plateforme vers R2 (20 nov. 2026,
  // même principe que InstitutionPortalService.creerUrlUploadLogo /
  // ComptableService.creerUrlUploadLogo) — le navigateur PUT ensuite le
  // fichier directement sur R2, puis PATCH admin/platform-settings avec
  // l'URL publique obtenue.
  creerUrlUploadLogo(contentType: string) {
    return this.storage.creerUrlUpload("platform/logo", contentType);
  }

  /**
   * Identité d'ELEGANZ elle-même, prête à être passée au renderer PDF
   * exclusivement admin (dossier-credit-plateforme-pdf-renderer.ts) — même
   * principe que InstitutionPortalService.identitePourPdf /
   * ComptableService.identitePourPdf : centralise la récupération du logo
   * (recupererLogoDepuisUrl, avec son garde-fou de taille/délai).
   */
  async identitePourPdf(): Promise<IdentitePourPdf> {
    const settings = await this.get();
    const logo = await recupererLogoDepuisUrl(settings.logoUrl);
    return {
      name: "ELEGANZ",
      logo,
      address: settings.address,
      headerNote: settings.headerNote,
      footerNote: settings.footerNote,
    };
  }

  /**
   * Lecture publique de la tarification livreur (prompt du 13 oct. 2026,
   * point 1) — affichée sur l'écran d'inscription livreur pour la
   * transparence, sans authentification. Seulement ces trois valeurs ici ;
   * les coordonnées de contact ont leur propre point d'entrée dédié,
   * `publicContactInfo()` ci-dessus.
   */
  async publicDriverPricing() {
    const settings = await this.get();
    return {
      driverOpeningFee: settings.driverOpeningFee,
      driverMonthlyFee: settings.driverMonthlyFee,
      driverFreeMonths: settings.driverFreeMonths,
    };
  }

  /** Lecture publique de la tarification Secourable (prompt §14) — même logique que publicDriverPricing. */
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
   * sans authentification, pour que Marketplace, Caisse et Secourable
   * puissent tous afficher les équivalents de devise. `cdfPerUsd` est `null`
   * tant qu'aucun admin ne l'a configuré : l'appelant doit alors simplement
   * ne rien convertir, jamais supposer une valeur par défaut.
   */
  async publicExchangeRate() {
    const settings = await this.get();
    return {
      cdfPerUsd: settings.cdfPerUsd,
      updatedAt: settings.exchangeRateUpdatedAt,
      // Devise d'affichage par défaut (19 nov. 2026) — regroupée ici plutôt
      // que sur une route publique séparée : c'est déjà l'endpoint que tout
      // écran lit pour afficher un montant, voir display-currency.tsx.
      defaultDisplayCurrency: settings.defaultDisplayCurrency,
    };
  }

  /**
   * Lecture publique de la tarification des services à la carte (14 oct.
   * 2026, plan commercial) — sans authentification, pour qu'une boutique
   * puisse voir le prix avant de demander un achat de crédits IA, et le
   * statut/tarif du SMS/WhatsApp premium (affichage uniquement, voir le
   * commentaire sur `smsWhatsappPremiumEnabled` dans schema.prisma : aucune
   * fonctionnalité réelle n'y est encore branchée).
   */
  async publicAlaCartePricing() {
    const settings = await this.get();
    return {
      aiCreditUnitPrice: settings.aiCreditUnitPrice,
      smsWhatsappPremiumEnabled: settings.smsWhatsappPremiumEnabled,
      smsWhatsappPremiumMonthlyFee: settings.smsWhatsappPremiumMonthlyFee,
    };
  }
}
