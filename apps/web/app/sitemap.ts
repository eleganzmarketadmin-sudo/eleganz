import type { MetadataRoute } from "next";

/**
 * Sitemap (11 nov. 2026, amélioration "expérience grand public", point 2 :
 * référencement) — sans ça, aucune fiche produit/boutique/catégorie n'était
 * individuellement proposée à Google pour indexation ; seule la page
 * d'accueil avait une chance d'être trouvée par recherche organique,
 * obligeant même un visiteur qui cherche un article précis à repasser par
 * le portail de choix de module.
 *
 * Next.js sert ce fichier à `/sitemap.xml` automatiquement (App Router,
 * convention `app/sitemap.ts`) — rien à câbler côté serveur web.
 *
 * Tiré directement des mêmes points d'API publics (sans authentification)
 * que la Marketplace elle-même (`/marketplace/products`,
 * `/marketplace/shops`, `/categories`) — jamais de boutique/produit non
 * publié, ces points filtrent déjà `isPublished`/`isPubliclyListed` côté
 * service.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.eleganzmarket.com";

interface ProduitSitemap {
  id: string;
  updatedAt?: string;
}

interface BoutiqueSitemap {
  slug: string;
  updatedAt?: string;
}

interface CategorieSitemap {
  id: string;
  name: string;
}

async function recupererJson<T>(chemin: string): Promise<T[]> {
  try {
    const reponse = await fetch(`${API_BASE}${chemin}`, { next: { revalidate: 3600 } });
    if (!reponse.ok) return [];
    return (await reponse.json()) as T[];
  } catch {
    // Un sitemap partiel (ou réduit aux seules pages statiques) vaut
    // toujours mieux qu'une génération qui échoue entièrement.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [produits, boutiques, categories] = await Promise.all([
    recupererJson<ProduitSitemap>("/marketplace/products"),
    recupererJson<BoutiqueSitemap>("/marketplace/shops"),
    recupererJson<CategorieSitemap>("/categories"),
  ]);

  const pagesStatiques: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/marketplace`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/marketplace/experts`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/aide`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/a-propos`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const pagesProduits: MetadataRoute.Sitemap = produits.map((p) => ({
    url: `${SITE_URL}/marketplace/produit/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const pagesBoutiques: MetadataRoute.Sitemap = boutiques.map((b) => ({
    url: `${SITE_URL}/marketplace/boutique/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Pas de page dédiée par catégorie à ce jour (le filtre catégorie vit
  // dans l'URL de recherche de la Marketplace) — on référence quand même la
  // recherche filtrée, utile pour une requête du type "acheter [catégorie]
  // Kinshasa" tant qu'aucune page de catégorie distincte n'existe.
  const pagesCategories: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/marketplace?category=${encodeURIComponent(c.name)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...pagesStatiques, ...pagesProduits, ...pagesBoutiques, ...pagesCategories];
}
