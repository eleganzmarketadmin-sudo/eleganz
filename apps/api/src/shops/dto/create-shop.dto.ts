import { IsEnum, IsString, MinLength } from "class-validator";
import { ShopMode } from "@eleganz/database";

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Une boutique naît toujours PRIVATE ou HYBRID — jamais directement MARKETPLACE
  // sans passer par la publication volontaire décrite dans le complément stratégique §12.
  @IsEnum([ShopMode.PRIVATE, ShopMode.HYBRID])
  mode!: typeof ShopMode.PRIVATE | typeof ShopMode.HYBRID;
}
