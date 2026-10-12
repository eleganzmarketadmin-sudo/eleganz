import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { UserRole } from "@eleganz/database";

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  // Un nouvel inscrit crée un compte ACHETEUR, VENDEUR ou LIVREUR ; les rôles
  // admin sont attribués séparément, jamais choisis librement à l'inscription.
  // Pour un livreur, le compte est créé non vérifié (Driver.verified = false,
  // voir DeliveryService.registerDriver) — l'auto-inscription ne donne donc
  // accès à aucune mission réelle avant validation par l'administration
  // (prompt §10 : « inscription et vérification »).
  @IsEnum([UserRole.BUYER, UserRole.SHOP_OWNER, UserRole.DRIVER])
  role!: typeof UserRole.BUYER | typeof UserRole.SHOP_OWNER | typeof UserRole.DRIVER;
}
