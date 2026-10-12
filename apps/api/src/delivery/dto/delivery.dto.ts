import { IsEnum, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";
import { DriverVehicleType } from "@eleganz/database";

export class CreateDeliveryZoneDto {
  @IsString()
  commune!: string;

  @IsNumber()
  @Min(0)
  fee!: number;
}

/**
 * Informations d'inscription d'un livreur (prompt du 13 oct. 2026, point 2) :
 * tout ce dont l'administration a besoin pour instruire le dossier avant de
 * valider la souscription (verified = true) — identité, coordonnées, et
 * véhicule. Plaque et permis ne sont exigés qu'en moto/voiture ; un livreur
 * à pied ou à vélo n'a ni l'un ni l'autre.
 */
export class RegisterDriverDto {
  @IsString()
  zone!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsString()
  address!: string;

  @IsEnum(DriverVehicleType)
  vehicleType!: DriverVehicleType;

  @ValidateIf((dto) => dto.vehicleType === DriverVehicleType.MOTO || dto.vehicleType === DriverVehicleType.VOITURE)
  @IsString()
  vehiclePlate?: string;

  @ValidateIf((dto) => dto.vehicleType === DriverVehicleType.MOTO || dto.vehicleType === DriverVehicleType.VOITURE)
  @IsString()
  licenseNumber?: string;

  @IsString()
  idDocumentNumber!: string;
}
