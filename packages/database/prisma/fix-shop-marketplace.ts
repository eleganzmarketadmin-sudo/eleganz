import { PrismaClient } from "@prisma/client";

/**
 * Correctif ponctuel (19 oct. 2026) pour le bug : "le bouton publier sur la
 * marketplace dans gestion-catalogue n'a pas permis de voir le produit sur
 * la marketplace même après dix minutes".
 *
 * Cause : ShopsService.publishSelection ne mettait `Shop.isPubliclyListed`
 * à `true` que si `shop.mode === "PRIVATE"` au moment du clic. Une boutique
 * déjà en HYBRID ou MARKETPLACE (choisie ainsi dès la création, ou passée
 * là par un autre chemin) voyait ses produits passer à `isPublished: true`
 * sans jamais obtenir `isPubliclyListed: true` — ils restaient donc
 * invisibles indéfiniment sur la Marketplace (MarketplaceCatalogService
 * exige les deux). Le code a été corrigé (commit du 19 oct. 2026) pour que
 * toute nouvelle publication fixe systématiquement `isPubliclyListed: true`.
 *
 * Ce script corrige les boutiques DÉJÀ affectées par l'ancien bug, sans
 * toucher à aucune autre donnée :
 *   - uniquement les boutiques avec mode HYBRID ou MARKETPLACE,
 *   - qui ont déjà isPubliclyListed = false (sinon rien à corriger),
 *   - ET qui ont au moins un produit avec isPublished = true
 *     (preuve que le propriétaire a bien cliqué sur "Publier").
 * Idempotent : peut être exécuté plusieurs fois sans effet de bord.
 *
 * Usage :
 *   pnpm --filter @eleganz/database exec ts-node prisma/fix-shop-marketplace.ts
 *
 * Par défaut le script ne fait qu'un état des lieux (dry-run) et affiche
 * les boutiques qui SERAIENT corrigées. Ajouter --apply pour écrire :
 *   pnpm --filter @eleganz/database exec ts-node prisma/fix-shop-marketplace.ts --apply
 */
async function main() {
  const prisma = new PrismaClient();
  const appliquer = process.argv.includes("--apply");

  const boutiquesAffectees = await prisma.shop.findMany({
    where: {
      mode: { in: ["HYBRID", "MARKETPLACE"] },
      isPubliclyListed: false,
      products: { some: { isPublished: true } },
    },
    select: {
      id: true,
      name: true,
      mode: true,
      status: true,
      products: {
        where: { isPublished: true },
        select: {
          id: true,
          name: true,
          variants: { select: { stockQty: true } },
        },
      },
    },
  });

  if (boutiquesAffectees.length === 0) {
    console.log("Aucune boutique affectée par ce bug — rien à corriger.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `${boutiquesAffectees.length} boutique(s) affectée(s) par le bug (produits "publiés" mais invisibles) :\n`,
  );

  for (const shop of boutiquesAffectees) {
    console.log(`- ${shop.name} (${shop.id}) | mode=${shop.mode} | status=${shop.status}`);
    for (const p of shop.products) {
      const enStock = p.variants.filter((v) => v.stockQty > 0).length;
      const avertissement = enStock === 0 ? "  [⚠ aucune variante en stock → restera invisible même après correction]" : "";
      console.log(`    · ${p.name} — ${p.variants.length} variante(s), ${enStock} en stock${avertissement}`);
    }
  }

  if (!appliquer) {
    console.log("\nMode dry-run (par défaut) : aucune écriture effectuée. Relancer avec --apply pour corriger.");
    await prisma.$disconnect();
    return;
  }

  const ids = boutiquesAffectees.map((s) => s.id);
  const resultat = await prisma.shop.updateMany({
    where: { id: { in: ids } },
    data: { isPubliclyListed: true },
  });

  console.log(`\n${resultat.count} boutique(s) corrigée(s) : isPubliclyListed passé à true.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
