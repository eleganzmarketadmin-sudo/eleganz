import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SecteurActiviteBoutique, ShopMode } from "@eleganz/database";

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

  // Secteur d'activité (18 nov. 2026, chantier "gestion de risque autonome"
  // Phase 2) — purement informatif pour les institutions financières
  // partenaires, jamais utilisé par ELEGANZ pour accepter/refuser une
  // création de boutique. Facultatif à l'inscription, modifiable ensuite
  // depuis les paramètres (voir UpdateShopSecteurActiviteDto).
  @IsOptional()
  @IsEnum(SecteurActiviteBoutique)
  secteurActivite?: SecteurActiviteBoutique;
}
