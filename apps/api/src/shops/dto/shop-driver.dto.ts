import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Livreur propre à une boutique (13 oct. 2026, 1ʳᵉ demande du jour) — pas de
 * compte ELEGANZ, juste une fiche (nom, contact, véhicule) sous la
 * responsabilité de la boutique qui l'enregistre.
 */
export class CreateShopDriverDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;
}

export class UpdateShopDriverDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
