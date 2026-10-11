import { IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  password!: string;
}
