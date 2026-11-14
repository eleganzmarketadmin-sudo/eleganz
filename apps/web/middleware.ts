import { NextRequest, NextResponse } from "next/server";

/**
 * Bascule "/" vers la Marketplace pour un visiteur déjà venu, AVANT même que
 * le premier octet du HTML du portail ne soit envoyé (demande du 14 nov.
 * 2026, point 1 : "la marketplace utilisée comme page d'accueil",
 * signalement : "sur ordinateur, le chargement de eleganzmarket.com
 * transite quelques secondes sur l'ancienne page de garde").
 *
 * Jusqu'ici cette bascule se faisait uniquement côté client (voir
 * MarqueurVisiteMarketplace.tsx + l'effet dans page.tsx) : le portail de
 * choix de module (page.tsx) était donc TOUJOURS peint à l'écran en premier
 * (rendu serveur), puis remplacé par la Marketplace seulement après
 * l'hydratation React — ce remplacement tardif est précisément le "passage
 * par l'ancienne page" rapporté, d'autant plus visible que l'appareil met
 * du temps à télécharger/exécuter le JavaScript avant de pouvoir lire le
 * localStorage et rediriger. Un middleware s'exécute avant tout rendu :
 * la redirection part donc du serveur, sans jamais afficher le portail à
 * un visiteur qui n'a rien demandé de tel — sur ordinateur comme sur
 * téléphone ou dans l'app installée.
 *
 * Lit un COOKIE (posé par MarqueurVisiteMarketplace.tsx en plus du
 * localStorage déjà existant, conservé pour le secours côté client
 * ci-dessous) plutôt que le localStorage : un middleware s'exécute sur le
 * serveur/à la périphérie, qui n'a pas accès au localStorage du
 * navigateur.
 *
 * Deux échappatoires conservées (voir page.tsx, jamais retiré) pour ne
 * jamais enfermer un visiteur qui veut explicitement voir le portail de
 * choix de module : `?portail=1` (lisible ici, côté serveur) et `#outils`
 * (fragment d'URL, jamais envoyé au serveur — SiteHeader.tsx combine
 * désormais les deux dans son lien "Se connecter" : `/?portail=1#outils`).
 *
 * `page.tsx` garde son propre effet client équivalent en secours (ex. :
 * cookies bloqués mais localStorage disponible) — les deux lisent le même
 * repère "déjà venu", seul le moment où la décision est prise change ici.
 */
export function middleware(request: NextRequest) {
  const demandeExpliciteDuPortail = request.nextUrl.searchParams.get("portail") === "1";
  const dejaVisiteMarketplace = request.cookies.get("eleganz_marketplace_visite")?.value === "1";

  if (dejaVisiteMarketplace && !demandeExpliciteDuPortail) {
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
