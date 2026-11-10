import { IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class ClesAbonnementDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class CreerAbonnementPushDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @ValidateNested()
  @Type(() => ClesAbonnementDto)
  keys!: ClesAbonnementDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class SupprimerAbonnementPushDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;
}
