import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateTresorerieCompteDto {
  @IsIn(["BANQUE", "MOBILE_MONEY"])
  type!: "BANQUE" | "MOBILE_MONEY";

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  devise?: string;
}

export class CreateMouvementTresorerieDto {
  @IsIn(["ENTREE", "SORTIE"])
  sens!: "ENTREE" | "SORTIE";

  @IsNumber()
  @Min(0.01)
  montant!: number;

  // Code du compte de contrepartie (ex. "5711" pour un dépôt depuis la
  // caisse USD, "671" pour des frais bancaires, "601"/"401" pour un achat
  // payé par ce compte...) — saisie libre parmi les comptes déjà existants,
  // validée par AccountingService.enregistrer() (échoue si le code n'existe
  // pas pour cette boutique).
  @IsString()
  @MinLength(1)
  contrepartieCode!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class CreateRapprochementDto {
  @IsDateString()
  dateReleve!: string;

  @IsNumber()
  soldeReleve!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
