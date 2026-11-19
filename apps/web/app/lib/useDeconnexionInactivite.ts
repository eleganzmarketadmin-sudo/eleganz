"use client";

import { useEffect } from "react";

/**
 * Signalement du 11 nov. 2026 : un compte reste connecté indéfiniment, même
 * après une longue période sans navigation ou une fermeture complète de
 * l'appli — aucune limite de session ne s'appliquait jusqu'ici, quel que
 * soit l'espace (Admin/Livreur/Secourable/Gestion-Marketplace).
 *
 * La dernière activité est horodatée dans localStorage (pas seulement en
 * mémoire) : elle survit donc à la fermeture totale de l'onglet/l'appli, et
 * se vérifie dès le retour — pas seulement pendant qu'un onglet reste ouvert
 * sans interaction. Deux heures de choix par défaut : assez long pour ne
 * jamais couper une session active, assez court pour qu'un appareil partagé
 * ou oublié ouvert ne reste pas connecté des jours entiers.
 */
const DUREE_INACTIVITE_MS = 2 * 60 * 60 * 1000;
const EVENEMENTS_ACTIVITE = ["mousedown", "keydown", "touchstart", "scroll"] as const;

function cleActivite(espace: string): string {
  return `eleganz_derniere_activite_${espace}`;
}

/**
 * Signalement du 19 nov. 2026 ("connexion réussie mais revient à la
 * connexion, sans erreur, sur tous les navigateurs et tous les écrans") —
 * cause réelle, distincte des trois correctifs précédents du 12-14 nov.
 * (hydratation, redirection RSC, cache du service worker) : l'effet
 * ci-dessous se déclenche dès que `connecte` passe à `true`, donc dès
 * l'INSTANT où une connexion vient de réussir — pas seulement au retour sur
 * un onglet resté ouvert, cas qu'il visait à l'origine (11 nov. 2026). S'il
 * restait en localStorage un horodatage `eleganz_derniere_activite_<espace>`
 * vieux de plus de deux heures — une session précédente dans ce même espace,
 * parfois ancienne de plusieurs jours —, `verifierExpiration()` le lisait
 * AVANT que `marquerActivite()` n'ait eu la moindre chance de le rafraîchir,
 * et appelait `logout()` : le jeton tout juste émis était effacé en silence,
 * quelques instants après son écriture, et la garde d'authentification de la
 * page suivante renvoyait alors vers la connexion — sans la moindre erreur
 * (ce n'est pas un échec, `logout()` fonctionne exactement comme prévu), avec
 * les champs vides (nouveau montage du formulaire après la navigation de
 * retour) : exactement le symptôme rapporté. Reproductible sur n'importe quel
 * navigateur dès que ce délai de deux heures est dépassé dans l'espace visé —
 * d'où "vider l'historique et les cookies" comme contournement : cela efface
 * aussi cet horodatage périmé (`derniere` retombe à 0, donc ignoré par
 * `if (derniere && ...)` ci-dessous).
 *
 * `marquerActiviteEspace()` est appelée directement dans auth.tsx (login/
 * register), immédiatement après l'écriture du jeton — avant que cet effet
 * n'ait pu s'exécuter, sur l'ancienne page comme sur la nouvelle après une
 * navigation complète — pour qu'un horodatage jamais périmé existe déjà
 * lorsque `verifierExpiration()` s'exécute, quel que soit l'ordre réel
 * d'exécution entre React et la navigation du navigateur.
 */
export function marquerActiviteEspace(espace: string): void {
  try {
    window.localStorage.setItem(cleActivite(espace), String(Date.now()));
  } catch {
    // stockage indisponible (navigation privée) — rien à dégrader de plus,
    // voir le même garde-fou dans setToken() (api.ts).
  }
}

export function useDeconnexionInactivite(espace: string, connecte: boolean, logout: () => void) {
  useEffect(() => {
    if (!connecte || typeof window === "undefined") return;
    const cle = cleActivite(espace);

    function lireDerniereActivite(): number {
      try {
        return Number(window.localStorage.getItem(cle) ?? "0");
      } catch {
        return 0;
      }
    }

    function marquerActivite() {
      try {
        window.localStorage.setItem(cle, String(Date.now()));
      } catch {
        // stockage indisponible (navigation privée) — rien à dégrader de plus
      }
    }

    function verifierExpiration(): boolean {
      const derniere = lireDerniereActivite();
      if (derniere && Date.now() - derniere > DUREE_INACTIVITE_MS) {
        logout();
        return true;
      }
      return false;
    }

    // Vérifié dès le montage (donc dès le retour sur l'appli, onglet rouvert
    // ou appli relancée) avant de réarmer le chronomètre — sans ça, rouvrir
    // l'appli remettrait silencieusement le compteur à zéro.
    if (verifierExpiration()) return;
    marquerActivite();

    EVENEMENTS_ACTIVITE.forEach((ev) => window.addEventListener(ev, marquerActivite, { passive: true }));
    function surVisibilite() {
      if (document.visibilityState === "visible") {
        if (!verifierExpiration()) marquerActivite();
      }
    }
    document.addEventListener("visibilitychange", surVisibilite);

    // Sondage pendant une session restée ouverte et véritablement inactive
    // (aucun événement ci-dessus) — sinon le départ ne serait détecté qu'au
    // prochain retour sur l'onglet, potentiellement bien après le seuil.
    const minuteur = window.setInterval(verifierExpiration, 60_000);

    return () => {
      EVENEMENTS_ACTIVITE.forEach((ev) => window.removeEventListener(ev, marquerActivite));
      document.removeEventListener("visibilitychange", surVisibilite);
      window.clearInterval(minuteur);
    };
  }, [espace, connecte, logout]);
}
