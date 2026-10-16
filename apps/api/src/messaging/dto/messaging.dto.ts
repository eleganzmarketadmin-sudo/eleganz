import { IsOptional, IsString, MinLength } from "class-validator";

export class DemarrerConversationDto {
  @IsString()
  @MinLength(1)
  destinataireId!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  shopId?: string;

  @IsString()
  @MinLength(1)
  message!: string;
}

export class EnvoyerMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class ContacterBoutiqueDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  message!: string;
}

export class ContacterExpertDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  message!: string;
}
