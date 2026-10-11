import { IsNumber, IsString, Min } from "class-validator";

export class CreateDeliveryZoneDto {
  @IsString()
  commune!: string;

  @IsNumber()
  @Min(0)
  fee!: number;
}

export class RegisterDriverDto {
  @IsString()
  zone!: string;
}
