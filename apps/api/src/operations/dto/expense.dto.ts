import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Catégories listées dans le complément stratégique §8 — volontairement une
// chaîne contrainte plutôt qu'un enum Prisma, pour que l'admin puisse en
// ajouter sans migration de base de données.
const EXPENSE_CATEGORIES = [
  "loyer",
  "transport",
  "electricite",
  "salaires",
  "telecommunications",
  "livraison",
  "autre",
] as const;

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES)
  category!: (typeof EXPENSE_CATEGORIES)[number];

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
