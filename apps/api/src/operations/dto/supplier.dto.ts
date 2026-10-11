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
}
