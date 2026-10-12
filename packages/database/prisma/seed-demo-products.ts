import { PrismaClient } from "@prisma/client";

/**
 * Ajoute des produits de démonstration à la première boutique trouvée en
 * base — utilisé pour tester le catalogue, la caisse et la vitrine
 * Marketplace sans devoir tout saisir manuellement. Les images utilisent des
 * URLs publiques génériques (pas de vrai upload R2 ici) : le propriétaire
 * pourra les remplacer par de vraies photos téléversées depuis le
 * Catalogue.
 *
 * Usage :
 *   pnpm --filter @eleganz/database exec ts-node prisma/seed-demo-products.ts
 */
async function main() {
  const prisma = new PrismaClient();

  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) {
    console.error(
      "Aucune boutique trouvée — créez d'abord une boutique via « Ouvrir ma boutique » avant de lancer ce script.",
    );
    process.exit(1);
  }
  console.log(`Boutique ciblée : ${shop.name} (${shop.id})`);

  const produits = [
    {
      name: "Boubou wax brodé",
      description: "Boubou traditionnel en wax hollandais, broderie main au col.",
      category: "Robes & boubous",
      variants: [
        { size: "M", color: "Bleu royal", sellPrice: 45, stockQty: 6 },
        { size: "L", color: "Bleu royal", sellPrice: 45, stockQty: 4 },
        { size: "M", color: "Bordeaux", sellPrice: 45, stockQty: 3 },
      ],
    },
    {
      name: "Chemise bazin riche homme",
      description: "Chemise bazin riche, coupe ajustée, idéale cérémonie.",
      category: "Chemises",
      variants: [
        { size: "M", color: "Blanc", sellPrice: 38, stockQty: 8 },
        { size: "XL", color: "Blanc", sellPrice: 38, stockQty: 5 },
      ],
    },
    {
      name: "Sac à main cuir Kinshasa",
      description: "Sac à main en cuir véritable, fabrication locale, doublure intérieure.",
      category: "Maroquinerie",
      variants: [{ color: "Noir", sellPrice: 60, stockQty: 10 }],
    },
    {
      name: "Sandales en pagne",
      description: "Sandales artisanales à motifs pagne, semelle confort.",
      category: "Chaussures",
      variants: [
        { size: "38", sellPrice: 22, stockQty: 7 },
        { size: "40", sellPrice: 22, stockQty: 5 },
        { size: "42", sellPrice: 22, stockQty: 2 },
      ],
    },
    {
      name: "Ensemble pagne deux pièces",
      description: "Haut et jupe assortis en pagne imprimé, coupe moderne.",
      category: "Ensembles",
      variants: [
        { size: "S", color: "Jaune soleil", sellPrice: 52, stockQty: 4 },
        { size: "M", color: "Jaune soleil", sellPrice: 52, stockQty: 0 }, // rupture volontaire pour tester l'affichage
      ],
    },
  ];

  let skuCounter = 1;
  for (const p of produits) {
    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: p.name,
        description: p.description,
        category: p.category,
        images: [],
        isPublished: true,
        variants: {
          create: p.variants.map((v) => ({
            sku: `DEMO-${String(skuCounter++).padStart(4, "0")}`,
            size: "size" in v ? v.size : undefined,
            color: "color" in v ? v.color : undefined,
            sellPrice: v.sellPrice,
            currency: "USD",
            stockQty: v.stockQty,
          })),
        },
      },
    });
    console.log(`Créé : ${product.name}`);
  }

  console.log(`${produits.length} produits de démonstration créés avec succès.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
