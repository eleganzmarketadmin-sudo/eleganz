import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

// Carnet d'adresses de l'acheteur (prompt du 15 oct. 2026, demande UX
// point 2 : "menu profil" avec adresses réutilisables) — reprend les mêmes
// champs libres que la commande Marketplace (commande/page.tsx), pour
// pouvoir pré-remplir ce même formulaire depuis une adresse enregistrée.
// Aucune coordonnée GPS saisie manuellement : latitude/longitude restent
// réservées à un usage futur (géolocalisation automatique), jamais
// déduites d'un champ texte.
export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  avenue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  repere?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}
