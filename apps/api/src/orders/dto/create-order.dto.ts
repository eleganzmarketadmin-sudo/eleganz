import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, ValidateNested } from "class-validator";

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
}
