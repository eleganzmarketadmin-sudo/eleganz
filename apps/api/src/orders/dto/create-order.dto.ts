import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class OrderItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderDto {
  // Le panier peut contenir des articles de plusieurs boutiques (prompt §48) —
  // c'est OrdersService qui les répartit en sous-commandes par boutique.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  // Coordonnées de livraison (prompt du 12 oct. 2026) — permettent à la
  // boutique de joindre le client et d'organiser la livraison. Aucun champ
  // n'est obligatoire côté validation : certains acheteurs n'ont qu'un
  // numéro, d'autres préfèrent tout détailler — mieux vaut enregistrer ce
  // qui est fourni que de bloquer la commande.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  buyerWhatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  buyerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryCommune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryQuartier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deliveryAvenue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryRepere?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryNote?: string;
}
