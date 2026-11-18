import { IsIn, IsOptional, IsString } from "class-validator";

// Validation (ou rejet) d'une analyse de crédit automatique par un analyste
// (chantier "gestion de risque autonome", 16 nov. 2026) — voir AnalyseCredit
// dans schema.prisma. REJETEE ne relance pas de nouveau calcul ici : c'est
// AnalyseCreditService.genererAnalyse (déclenché séparément, écran "relancer
// l'analyse") qui recalcule, jamais ce DTO — une validation/rejet reste un
// acte distinct du calcul lui-même.
export class ValiderAnalyseCreditDto {
  @IsIn(["VALIDEE", "REJETEE"])
  decision!: "VALIDEE" | "REJETEE";

  @IsOptional()
  @IsString()
  note?: string;
}
