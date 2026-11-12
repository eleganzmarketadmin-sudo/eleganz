import type { MetadataRoute } from "next";

/**
 * robots.txt (11 nov. 2026, amélioration "expérience grand public", point
 * 2 : référencement) — sert `/robots.txt` automatiquement (convention App
 * Router `app/robots.ts`). Autorise tout ce qui est public ; bloque les
 * écrans authentifiés (rien à indexer derrière une connexion) ainsi que le
 * panier/les commandes (pages personnelles, jamais la même pour deux
 * visiteurs).
 *
 * Attention : `apps/web/app/(gestion)` est un groupe de routes Next.js —
 * ses sous-dossiers ne sont PAS préfixés par "/gestion" dans l'URL réelle
 * (ex. `(gestion)/caisse` → `/caisse`, pas `/gestion/caisse`). La liste
 * ci-dessous utilise donc les chemins réels tels qu'ils apparaissent dans
 * le navigateur, jamais le nom du dossier entre parenthèses — même
 * vigilance que l'incident documenté pour `espaceAuth()` (voir
 * docs/MAINTENANCE.md).
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.eleganzmarket.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/livreur",
        "/comptable",
        // Écrans Gestion authentifiés (voir le commentaire ci-dessus sur le
        // groupe de routes (gestion) — chemins réels, pas de préfixe).
        "/tableau-de-bord",
        "/caisse",
        "/catalogue",
        "/boutique/",
        "/equipe",
        "/factures",
        "/finance",
        "/litiges",
        "/livreurs",
        "/messagerie",
        "/parametres",
        "/releves",
        // Pages personnelles côté Marketplace (acheteur).
        "/marketplace/compte",
        "/marketplace/commandes",
        "/marketplace/commande",
        "/marketplace/panier",
        "/marketplace/messagerie",
        "/marketplace/profil",
        "/mot-de-passe-oublie",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
