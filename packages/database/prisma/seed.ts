import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/**
 * Crée (ou met à jour le mot de passe de) le compte administrateur ELEGANZ
 * décidé par le propriétaire du projet (décision #5 : eleganzmarket.admin@
 * gmail.com). Un compte ADMIN_* ne peut pas être créé via /auth/register
 * (volontairement réservé à BUYER/SHOP_OWNER) — c'est le seul chemin prévu
 * pour en obtenir un.
 *
 * Usage :
 *   ELEGANZ_ADMIN_EMAIL=eleganzmarket.admin@gmail.com \
 *   ELEGANZ_ADMIN_PASSWORD=<mot de passe choisi par le propriétaire> \
 *   pnpm --filter @eleganz/database exec prisma db seed
 *
 * Aucun mot de passe par défaut n'est codé en dur : sans
 * ELEGANZ_ADMIN_PASSWORD, le script s'arrête sans rien créer.
 */
async function main() {
  const prisma = new PrismaClient();
  const email = process.env.ELEGANZ_ADMIN_EMAIL ?? "eleganzmarket.admin@gmail.com";
  const password = process.env.ELEGANZ_ADMIN_PASSWORD;

  if (!password) {
    console.error(
      "ELEGANZ_ADMIN_PASSWORD n'est pas défini — aucun compte administrateur créé. " +
        "Voir le commentaire en haut de prisma/seed.ts pour l'usage.",
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN_SUPER },
    create: {
      email,
      passwordHash,
      fullName: "Administration ELEGANZ",
      role: UserRole.ADMIN_SUPER,
    },
  });

  console.log(`Compte administrateur prêt : ${admin.email} (rôle ${admin.role}).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
