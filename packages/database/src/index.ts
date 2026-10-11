import { PrismaClient } from "@prisma/client";

// Un seul client Prisma partagé entre apps/api et tout script d'outillage.
// Ne pas instancier PrismaClient ailleurs dans le monorepo.
export const prisma = new PrismaClient();

export * from "@prisma/client";
