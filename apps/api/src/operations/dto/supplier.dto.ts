import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RecordPurchaseDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  receivedAt?: string;

  // Si vrai, le montant reste en dette fournisseur (Supplier.balanceOwed) ;
  // si faux, on considère l'achat payé comptant.
  @IsOptional()
  onCredit?: boolean;

  // Échéance de paiement — ajouté le 14 oct. 2026 (chantier SYSCOHADA,
  // créances & dettes). Optionnel : aucune échéance n'est inventée si
  // l'utilisateur ne la saisit pas.
  @IsOptional()
  @IsString()
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
  method?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;
}
