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
 */
export function MarqueurVisiteMarketplace() {
  useEffect(() => {
    try {
      localStorage.setItem("eleganz_marketplace_visite", "1");
    } catch {
      // Navigateur privé / stockage bloqué : tant pis, l'accueil restera
      // simplement le portail de choix de module à chaque visite.
    }
  }, []);

  return null;
}
