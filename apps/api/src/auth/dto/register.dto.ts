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

  // Un nouvel inscrit crée un compte ACHETEUR ou VENDEUR ; les rôles admin et
  // livreur sont attribués séparément, jamais choisis librement à l'inscription.
  @IsEnum([UserRole.BUYER, UserRole.SHOP_OWNER])
  role!: typeof UserRole.BUYER | typeof UserRole.SHOP_OWNER;
}
