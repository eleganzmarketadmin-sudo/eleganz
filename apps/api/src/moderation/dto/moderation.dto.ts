import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export const ISSUES_SIGNALEMENT = ["TRAITE", "IGNORE"] as const;
export type IssueSignalement = (typeof ISSUES_SIGNALEMENT)[number];

export class ResolveModerationFlagDto {
  @IsIn(ISSUES_SIGNALEMENT)
  status!: IssueSignalement;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateModerationTermDto {
  @IsString()
  @MinLength(2)
  term!: string;
}
