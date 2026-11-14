"use client";

import { useEffect } from "react";

/**
 * Marqueur de visite Marketplace (11 nov. 2026, amélioration "expérience
 * grand public", point 4 : raccourci pour un acheteur déjà venu) — ne fait
 * rien de visible, pose juste un repère dans `localStorage` du navigateur
 * dès qu'un visiteur atterrit sur une page quelconque de la Marketplace.
 * Lu ensuite par la page d'accueil (`app/page.tsx`) pour sauter directement
 * en Marketplace à la prochaine visite de "/", sans repasser par le menu de
 * choix de module.
 *
 * Volontairement PAS lié à une connexion/un compte : même si passer une
 * commande exige aujourd'hui un compte (voir marketplace/commande/page.tsx),
 * un visiteur peut très bien parcourir longuement le catalogue avant de se
 * décider à en créer un — "déjà venu" est le bon signal ici, pas "déjà
 * authentifié", justement pour ne pas perdre ce visiteur-là en le renvoyant
 * sans arrêt au portail de choix de module.
 *
 * Pose aussi un COOKIE équivalent (14 nov. 2026, voir middleware.ts) : le
 * localStorage ci-dessous reste lu par l'effet de secours de page.tsx
 * (ex. cookies bloqués), mais c'est le cookie qui permet au serveur de
 * basculer "/" vers la Marketplace avant même d'envoyer le HTML du
 * portail — localStorage n'est lisible que dans le navigateur, trop tard
 * pour éviter le flash de l'ancienne page de garde.
 */
export function MarqueurVisiteMarketplace() {
  useEffect(() => {
    try {
      localStorage.setItem("eleganz_marketplace_visite", "1");
    } catch {
      // Navigateur privé / stockage bloqué : tant pis, l'accueil restera
      // simplement le portail de choix de module à chaque visite.
    }
    try {
      // Un an, chemin racine : lu par middleware.ts sur chaque visite de
      // "/". `samesite=lax` suffit (navigation top-level classique) et
      // laisse le cookie fonctionner aussi bien en http:// local qu'en
      // https:// en production, sans attribut `secure` qui casserait le
      // développement local.
      document.cookie = "eleganz_marketplace_visite=1; path=/; max-age=31536000; samesite=lax";
    } catch {
      // Cookies bloqués : le middleware ne verra rien, l'effet de secours
      // de page.tsx (localStorage) prend le relais après hydratation.
    }
  }, []);

  return null;
}
