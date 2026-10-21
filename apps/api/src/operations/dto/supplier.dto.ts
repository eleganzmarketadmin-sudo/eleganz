import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateSupplierDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class RecordPurchaseDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  // `@IsDateString`/`@IsBoolean` ajoutés le 21 oct. 2026 (audit sécurité) —
  // sans décorateur de type, class-validator n'imposait aucune forme à ces
  // champs (un objet ou un tableau aurait pu passer), et une chaîne non-date
  // produisait silencieusement un `Invalid Date` stocké.
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  // Si vrai, le montant reste en dette fournisseur (Supplier.balanceOwed) ;
  // si faux, on considère l'achat payé comptant.
  @IsOptional()
  @IsBoolean()
  onCredit?: boolean;

  // Échéance de paiement — ajouté le 14 oct. 2026 (chantier SYSCOHADA,
  // créances & dettes). Optionnel : aucune échéance n'est inventée si
  // l'utilisateur ne la saisit pas.
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class SettleDebtDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  // Rattache ce règlement à un achat précis — lettrage par saisie
  // explicite, pas un rapprochement automatique entre plusieurs pièces.
  @IsOptional()
  @IsString()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
