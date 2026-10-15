import { IsString } from "class-validator";

export class AddDeliveryZoneDto {
  @IsString()
  cityId: string;
}
