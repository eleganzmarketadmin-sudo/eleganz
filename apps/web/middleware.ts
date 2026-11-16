import { NextRequest, NextResponse } from "next/server";

/**
 * Bascule "/" vers la Marketplace pour TOUT visiteur, AVANT même que le
 * premier octet du HTML du portail ne soit envoyé (signalement du 16 nov.
 * 2026 : le portail de choix de module — page.tsx — continuait d'apparaître
 * par défaut à un nouveau visiteur, puisque la bascule ne s'appliquait
 * jusqu'ici qu'à un visiteur déjà passé par la Marketplace, voir le cookie
 * `eleganz_marketplace_visite` posé par MarqueurVisiteMarketplace.tsx).
 * Cette condition a été retirée : la Marketplace est maintenant la page
 * d'accueil pour tout le monde, sans exception liée à une visite passée.
 *
 * Le contenu de l'ancien portail (message de bienvenue + carré de marque à
 * 4 couleurs) n'est pas perdu : il vit maintenant aussi dans /a-propos (voir
 * a-propos/page.tsx), et le portail lui-même reste en place, inchangé,
 * seulement pour qui le demande explicitement (voir l'échappatoire
 * ci-dessous).
 *
 * Échappatoire conservée (voir page.tsx, jamais retirée) pour ne jamais
 * enfermer un visiteur qui veut explicitement voir le portail de choix de
 * module : `?portail=1` (lisible ici, côté serveur) — SiteHeader.tsx s'en
 * sert dans son lien "Se connecter" (`/?portail=1#outils`, le `#outils`
 * n'étant lui qu'un fragment client, jamais vu ici).
 */
export function middleware(request: NextRequest) {
  const demandeExpliciteDuPortail = request.nextUrl.searchParams.get("portail") === "1";

  if (!demandeExpliciteDuPortail) {
    return NextResponse.redirect(new URL("/marketplace", request.url));
  }

  return NextResponse.next();
}

// Uniquement la racine : pas besoin (et pas souhaitable, coût d'exécution
// inutile) de faire tourner ce middleware sur chaque route de la
// plateforme — seul "/" a ce choix à faire.
export const config = {
  matcher: "/",
};
