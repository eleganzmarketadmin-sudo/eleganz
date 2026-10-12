import { PrismaClient } from "@prisma/client";

/**
 * Corrige directement l'état "publication Marketplace" de la première
 * boutique trouvée (mode HYBRID + isPubliclyListed true), et affiche le
 * détail des produits/variantes pour diagnostiquer pourquoi la vitrine
 * publique pourrait rester vide (ex. aucune variante en stock).
 *
 * Usage :
 *   pnpm --filter @eleganz/database exec ts-node prisma/fix-shop-marketplace.ts
 */
async function main() {
  const prisma = new PrismaClient();

  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) {
    console.error("Aucune boutique trouvée.");
    process.exit(1);
  }

  console.log("Avant correction :", {
    name: shop.name,
    mode: shop.mode,
    status: shop.status,
    isPubliclyListed: shop.isPubliclyListed,
  });

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { mode: "HYBRID", isPubliclyListed: true },
  });

  console.log("Après correction :", {
    mode: updated.mode,
    status: updated.status,
    isPubliclyListed: updated.isPubliclyListed,
  });

  const produits = await prisma.product.findMany({
    where: { shopId: shop.id },
    include: { variants: true },
  });

  console.log(`\n${produits.length} produits dans cette boutique :`);
  for (const p of produits) {
    const enStock = p.variants.filter((v) => v.stockQty > 0).length;
    console.log(
      `- ${p.name} | isPublished=${p.isPublished} | ${p.variants.length} variante(s), ${enStock} en stock`,
    );
  }

  const visiblesSurMarketplace = produits.filter(
    (p) => p.isPublished && p.variants.some((v) => v.stockQty > 0),
  );
  console.log(
    `\n=> ${visiblesSurMarketplace.length} produit(s) devraient maintenant apparaître sur la Marketplace.`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
