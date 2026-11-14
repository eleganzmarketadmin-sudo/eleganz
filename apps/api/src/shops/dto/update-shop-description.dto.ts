import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Description publique de la boutique (14 nov. 2026, demande : zone
 * description affichée sur la page propre de la boutique côté Marketplace,
 * modifiable depuis les paramètres de la boutique). Distincte de
 * UpdateInvoiceSettingsDto, qui ne couvre que l'identité sur les documents
 * imprimés — cette description est destinée aux visiteurs de la Marketplace,
 * pas aux factures/tickets.
 */
export class UpdateShopDescriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;
}
