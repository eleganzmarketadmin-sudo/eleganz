import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

/**
 * Coordonnées officielles de la plateforme ELEGANZ, modifiables depuis le
 * Centre de pilotage (prompt du 12 oct. 2026). Tous facultatifs — un champ
 * envoyé comme chaîne vide efface l'information plutôt que de la laisser
 * inchangée. Pas de validation stricte de format (URL/email) : un admin
 * doit pouvoir coller un lien WhatsApp/Telegram tel quel sans friction.
 */
export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  whatsappLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  telegramLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  instagramUrl?: string;

  // Fonctionnalités IA prévues mais coupées par défaut (voir schema.prisma) —
  // l'admin les active lui-même une fois un fournisseur choisi et payé.
  @IsOptional()
  @IsBoolean()
  photoSearchEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  adStudioEnabled?: boolean;

  // Tarification de l'espace livreur (prompt du 13 oct. 2026, point 1) —
  // 100 % paramétrable depuis le Centre de pilotage, sans redéploiement.
  @IsOptional()
  @IsNumber()
  @Min(0)
  driverOpeningFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  driverMonthlyFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  driverFreeMonths?: number;

  // Tarification d'ELEGANZ Mon Comptable (prompt du 13 oct. 2026, §14).
  @IsOptional()
  @IsNumber()
  @Min(0)
  comptableMonthlyFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comptableYearlyFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  comptableFreeMonths?: number;

  // Taux de commission (%) par défaut sur les transactions ELEGANZ Market
  // (14 oct. 2026, plan commercial) — utilisé quand le bouquet Marketplace
  // de la boutique n'en fixe pas un lui-même.
  @IsOptional()
  @IsNumber()
  @Min(0)
  marketplaceCommissionRateDefault?: number;
}
