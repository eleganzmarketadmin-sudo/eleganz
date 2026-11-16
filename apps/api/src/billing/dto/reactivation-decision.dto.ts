import { IsIn, IsOptional, IsString } from "class-validator";

/** Décision admin sur une demande de réactivation ouverte automatiquement (16 nov. 2026, chantier relances/recouvrement). */
export class ReactivationDecisionDto {
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @IsOptional()
  @IsString()
  note?: string;
}
