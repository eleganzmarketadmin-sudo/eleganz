import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

/**
 * Business plan (demande du 16 oct. 2026, point 1) — sections narratives
 * libres, toutes facultatives : une boutique (ou ELEGANZ elle-même, côté
 * plateforme) les remplit à son rythme, rien n'est déduit ni présumé à sa
 * place. Alimente le dossier crédit et le futur rapport annuel.
 */
export class UpdateBusinessPlanDto {
  @IsOptional() @IsString() @MaxLength(4000) resumeExecutif?: string;
  @IsOptional() @IsString() @MaxLength(4000) descriptionActivite?: string;
  @IsOptional() @IsString() @MaxLength(4000) marcheEtClientele?: string;
  @IsOptional() @IsString() @MaxLength(4000) strategieCroissance?: string;
  @IsOptional() @IsString() @MaxLength(4000) utilisationFonds?: string;
  @IsOptional() @IsString() @MaxLength(4000) risquesMitigation?: string;

  // Business Model Canvas (14 nov. 2026) — mêmes contraintes que les
  // sections narratives ci-dessus, voir schema.prisma::BusinessPlan.
  @IsOptional() @IsString() @MaxLength(4000) canvasSegmentsClientele?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasPropositionValeur?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasCanaux?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasRelationsClients?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasSourcesRevenus?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasRessourcesClefs?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasActivitesClefs?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasPartenairesClefs?: string;
  @IsOptional() @IsString() @MaxLength(4000) canvasStructureCouts?: string;
}

/**
 * Scénario de sollicitation de prêt — plusieurs scénarios peuvent coexister
 * sous un même business plan (ex. "Expansion stock" vs "Equipement
 * logistique") pour comparer plusieurs hypothèses de financement.
 */
export class CreateLoanScenarioDto {
  @IsString() @MinLength(1) @MaxLength(150) label: string;
  @IsNumber() @Min(0) montant: number;
  @IsNumber() @Min(0) @Max(100) tauxAnnuel: number;
  @IsInt() @Min(1) @Max(600) dureeMois: number;
  @IsOptional() @IsString() @MaxLength(300) objetFinancement?: string;
}

export class UpdateLoanScenarioDto extends CreateLoanScenarioDto {}
