import { IsEmail, IsEnum, IsOptional, IsNumber, IsString, Min, MinLength } from "class-validator";
import { TypeGarantieCredit } from "@eleganz/database";

// Soumission d'une demande de crédit par une boutique à une institution qui
// lui a déjà accordé l'accès (16 nov. 2026, demande du propriétaire, point
// 1) — distincte de l'octroi d'accès lui-même (GrantInstitutionAccessDto) :
// la boutique choisit ici un montant/une durée précis, éventuellement issus
// d'un LoanScenario déjà saisi dans son dossier crédit, et déclenche la
// génération du numéro de suivi (voir DemandeCreditService.soumettre).
export class SoumettreDemandeCreditDto {
  @IsString()
  @MinLength(1)
  institutionId!: string;

  // Référence libre (pas de contrainte de clé étrangère), même convention
  // que CreateLoanDecisionDto.scenarioId — un LoanScenario de la boutique
  // pré-remplit le formulaire côté écran, mais reste modifiable librement
  // avant soumission.
  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsNumber()
  @Min(0.01)
  montantDemande!: number;

  @IsNumber()
  @Min(1)
  dureeMoisDemandee!: number;

  @IsOptional()
  @IsString()
  objetFinancement?: string;

  // Garantie proposée — purement déclaratif par la boutique, voir
  // commentaire sur DemandeCredit dans schema.prisma. Jamais requis.
  @IsOptional()
  @IsEnum(TypeGarantieCredit)
  garantieType?: TypeGarantieCredit;

  @IsOptional()
  @IsString()
  garantieDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  garantieValeurEstimee?: number;
}

// Création libre et autonome d'une demande par l'institution elle-même
// (16 nov. 2026, même demande, point 1 : "possibilité d'en créer de manière
// libre et autonome") — pour un prospect qui n'est pas (encore) boutique
// ELEGANZ. `shopId` n'existe volontairement pas ici : voir le commentaire
// sur DemandeCredit dans schema.prisma.
export class CreerDemandeCreditLibreDto {
  @IsString()
  @MinLength(1)
  nomDemandeur!: string;

  @IsOptional()
  @IsString()
  contactTelephone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  raisonSociale?: string;

  @IsNumber()
  @Min(0.01)
  montantDemande!: number;

  @IsNumber()
  @Min(1)
  dureeMoisDemandee!: number;

  @IsOptional()
  @IsString()
  objetFinancement?: string;
}
