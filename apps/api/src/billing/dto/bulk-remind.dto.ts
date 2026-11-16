import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

/** Relance manuelle groupée depuis l'écran admin Factures (16 nov. 2026, chantier relances/recouvrement). */
export class BulkRemindDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  invoiceIds!: string[];
}
