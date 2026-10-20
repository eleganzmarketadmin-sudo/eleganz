import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { ShopMode } from "@eleganz/database";

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Une boutique naît toujours PRIVATE ou HYBRID — jamais directement MARKETPLACE
  // sans passer par la publication volontaire décrite dans le complément stratégique §12.
  @IsEnum([ShopMode.PRIVATE, ShopMode.HYBRID])
  mode!: typeof ShopMode.PRIVATE | typeof ShopMode.HYBRID;

  // Bouquet Gestion choisi sur la page de présentation à la création
  // (19 oct. 2026) — optionnel : si absent ou invalide, ShopsService.create
  // retombe sur le comportement précédent (bouquet actif le moins cher), pour
  // ne jamais bloquer une création de boutique à cause de ce choix.
  @IsOptional()
  @IsString()
  gestionBouquetId?: string;
}
