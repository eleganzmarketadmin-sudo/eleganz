import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Catégories listées dans le complément stratégique §8, réalignées sur la
// taxonomie Finance & Comptabilité du 13 oct. 2026 (§8 du nouveau prompt :
// Fonctionnement/Personnel/Charges administratives/Charges commerciales/
// Fiscalité/Financement) — volontairement une chaîne contrainte plutôt
// qu'un enum Prisma, pour que l'admin puisse en ajouter sans migration de
// base de données. Les valeurs déjà enregistrées (anciennes catégories)
// restent acceptées pour ne jamais invalider une dépense existante.
const EXPENSE_CATEGORIES = [
  // Fonctionnement
  "loyer",
  "eau",
  "electricite",
  "internet",
  "telecommunications",
  "transport",
  "carburant",
  "entretien",
  "reparations",
  "fournitures",
  // Personnel
  "salaires",
  "primes",
  "charges_sociales",
  // Charges administratives
  "frais_bancaires",
  "honoraires",
  "assurances",
  "abonnements_logiciels",
  // Charges commerciales
  "publicite",
  "promotions",
  "livraison",
  "emballages",
  "commissions",
  // Fiscalité
  "impots_taxes",
  // Financement
  "interets_frais_financiers",
  "remboursement_capital",
  "autre",
] as const;

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES)
  category!: (typeof EXPENSE_CATEGORIES)[number];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsIn(["USD", "CDF"])
  currency?: "USD" | "CDF";

  @IsOptional()
  @IsString()
  note?: string;
}
