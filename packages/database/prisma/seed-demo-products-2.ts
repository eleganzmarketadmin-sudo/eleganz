import { PrismaClient } from "@prisma/client";

/**
 * Suite de seed-demo-products.ts :
 * 1. Ajoute des photos aux 5 produits de démo créés précédemment (qui
 *    n'avaient aucune image).
 * 2. Crée 10 produits supplémentaires, avec photos, pour couvrir plus de
 *    catégories et des combinaisons taille/couleur variées (y compris
 *    plusieurs ruptures de stock volontaires pour tester cet affichage).
 *
 * Les photos utilisent picsum.photos (service de photos génériques
 * libres de droit, chaque "seed" dans l'URL donne toujours la même photo
 * — pratique pour des données de test stables). Ce sont des URLs
 * publiques directes, pas un vrai upload R2 : à remplacer par de vraies
 * photos produit via le bouton « Téléverser une photo » du Catalogue
 * quand les vendeurs ajouteront leurs propres articles.
 *
 * Usage :
 *   pnpm --filter @eleganz/database exec ts-node prisma/seed-demo-products-2.ts
 */

const photo = (seed: string, n = 1) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}-${i}/800/1000`);

async function main() {
  const prisma = new PrismaClient();

  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) {
    console.error("Aucune boutique trouvée — créez d'abord une boutique.");
    process.exit(1);
  }
  console.log(`Boutique ciblée : ${shop.name} (${shop.id})`);

  // --- 1. Photos pour les 5 produits déjà créés ---
  const anciens: Record<string, string> = {
    "Boubou wax brodé": "boubou-wax",
    "Chemise bazin riche homme": "bazin-homme",
    "Sac à main cuir Kinshasa": "sac-cuir",
    "Sandales en pagne": "sandales-pagne",
    "Ensemble pagne deux pièces": "ensemble-pagne",
  };
  for (const [name, seed] of Object.entries(anciens)) {
    const produit = await prisma.product.findFirst({ where: { shopId: shop.id, name } });
    if (produit && produit.images.length === 0) {
      await prisma.product.update({
        where: { id: produit.id },
        data: { images: photo(seed, 2) },
      });
      console.log(`Photos ajoutées : ${name}`);
    }
  }

  // --- 2. 10 nouveaux produits ---
  let skuCounter = 100;
  const nouveaux = [
    {
      name: "Robe de soirée en dentelle",
      description: "Robe longue en dentelle française, doublure satin, fermeture éclair invisible.",
      category: "Robes & boubous",
      seed: "robe-dentelle",
      variants: [
        { size: "S", color: "Noir", sellPrice: 85, stockQty: 3 },
        { size: "M", color: "Noir", sellPrice: 85, stockQty: 5 },
        { size: "M", color: "Rouge grenat", sellPrice: 85, stockQty: 0 },
        { size: "L", color: "Rouge grenat", sellPrice: 85, stockQty: 2 },
      ],
    },
    {
      name: "Costume trois pièces homme",
      description: "Costume complet (veste, gilet, pantalon) coupe slim, tissu laine mélangée.",
      category: "Costumes",
      seed: "costume-homme",
      variants: [
        { size: "48", color: "Gris anthracite", sellPrice: 180, stockQty: 2 },
        { size: "50", color: "Gris anthracite", sellPrice: 180, stockQty: 4 },
        { size: "50", color: "Bleu marine", sellPrice: 180, stockQty: 3 },
        { size: "52", color: "Bleu marine", sellPrice: 180, stockQty: 1 },
      ],
    },
    {
      name: "Baskets montantes unisexe",
      description: "Baskets en toile résistante, semelle caoutchouc antidérapante.",
      category: "Chaussures",
      seed: "baskets",
      variants: [
        { size: "39", color: "Blanc", sellPrice: 40, stockQty: 6 },
        { size: "41", color: "Blanc", sellPrice: 40, stockQty: 8 },
        { size: "41", color: "Noir", sellPrice: 40, stockQty: 0 },
        { size: "43", color: "Noir", sellPrice: 40, stockQty: 5 },
      ],
    },
    {
      name: "Collier perles artisanal",
      description: "Collier en perles de verre soufflé, fermoir laiton, fait main à Kinshasa.",
      category: "Bijoux",
      seed: "collier-perles",
      variants: [
        { color: "Turquoise", sellPrice: 18, stockQty: 12 },
        { color: "Ambre", sellPrice: 18, stockQty: 9 },
      ],
    },
    {
      name: "Veste en jean oversize",
      description: "Veste en denim brut, coupe oversize, boutons pression.",
      category: "Vestes & manteaux",
      seed: "veste-jean",
      variants: [
        { size: "M", color: "Bleu délavé", sellPrice: 55, stockQty: 4 },
        { size: "L", color: "Bleu délavé", sellPrice: 55, stockQty: 3 },
        { size: "L", color: "Noir", sellPrice: 55, stockQty: 0 },
      ],
    },
    {
      name: "Robe enfant fête",
      description: "Robe de cérémonie pour fillette, tulle et nœud satin à la taille.",
      category: "Mode enfant",
      seed: "robe-enfant",
      variants: [
        { size: "4 ans", color: "Rose poudré", sellPrice: 30, stockQty: 5 },
        { size: "6 ans", color: "Rose poudré", sellPrice: 30, stockQty: 3 },
        { size: "6 ans", color: "Blanc", sellPrice: 30, stockQty: 2 },
      ],
    },
    {
      name: "Ceinture cuir gravée",
      description: "Ceinture en cuir pleine fleur, boucle métal brossé, motif gravé sur mesure.",
      category: "Maroquinerie",
      seed: "ceinture-cuir",
      variants: [
        { size: "90cm", color: "Marron", sellPrice: 25, stockQty: 7 },
        { size: "100cm", color: "Marron", sellPrice: 25, stockQty: 6 },
        { size: "100cm", color: "Noir", sellPrice: 25, stockQty: 4 },
      ],
    },
    {
      name: "Survêtement sport deux pièces",
      description: "Ensemble jogging technique respirant, poches zippées.",
      category: "Sportswear",
      seed: "survetement",
      variants: [
        { size: "M", color: "Gris chiné", sellPrice: 48, stockQty: 6 },
        { size: "L", color: "Gris chiné", sellPrice: 48, stockQty: 0 },
        { size: "L", color: "Bleu nuit", sellPrice: 48, stockQty: 5 },
      ],
    },
    {
      name: "Foulard soie imprimé",
      description: "Foulard 100% soie, imprimé motifs géométriques, bords roulottés main.",
      category: "Accessoires",
      seed: "foulard-soie",
      variants: [
        { color: "Multicolore orangé", sellPrice: 20, stockQty: 10 },
        { color: "Multicolore bleuté", sellPrice: 20, stockQty: 8 },
      ],
    },
    {
      name: "Chapeau de fête brodé",
      description: "Chapeau cérémonie brodé fils dorés, idéal mariages et grandes occasions.",
      category: "Accessoires",
      seed: "chapeau-brode",
      variants: [
        { size: "Unique", color: "Doré", sellPrice: 35, stockQty: 3 },
        { size: "Unique", color: "Argenté", sellPrice: 35, stockQty: 0 },
      ],
    },
  ];

  for (const p of nouveaux) {
    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: p.name,
        description: p.description,
        category: p.category,
        images: photo(p.seed, 3),
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

  console.log(`${nouveaux.length} nouveaux produits créés, photos ajoutées aux 5 précédents.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
