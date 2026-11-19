"use client";

import { useEffect } from "react";

const CLE_RELANCE = "eleganz_relance_apres_erreur_chunk";
const FENETRE_MS = 15000;

function estErreurDeChunkPerime(message: string | undefined): boolean {
  if (!message) return false;
  return /ChunkLoadError|Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    message,
  );
}

/**
 * Filet de sécurité pour un onglet resté ouvert pendant un déploiement
 * (19 nov. 2026, signalement récurrent : "la connexion ne fonctionne pas sur
 * tous les navigateurs, oblige à vider l'historique/les cookies"). Les
 * correctifs du service worker (voir public/sw.js, scripts/inject-sw-
 * version.js, 14 nov. 2026) règlent le cas d'une page HTML/JS figée dans le
 * CACHE du service worker d'un déploiement à l'autre — mais pas celui-ci :
 * un onglet déjà ouvert AVANT un déploiement garde en mémoire le bundle JS
 * de l'ancienne version, et s'il tente ensuite de charger paresseusement un
 * morceau (chunk) de code dont le nom a changé au déploiement suivant
 * (fichier désormais introuvable côté serveur, 404), le navigateur lève une
 * erreur de chargement de module — sans aucun rapport avec le service
 * worker ni avec un cache à vider manuellement. Jusqu'ici rien n'écoutait
 * cette erreur précise : l'écran restait figé/muet, exactement le symptôme
 * signalé, et seul un rechargement complet (souvent perçu à tort comme
 * nécessitant de "vider les cookies") le réparait.
 *
 * On écoute donc directement cette erreur plutôt que de compter sur
 * global-error.tsx (qui ne capture que les erreurs remontées par React
 * pendant un rendu — un échec de chargement de chunk se produit souvent
 * avant même d'atteindre un composant, via une promesse rejetée) et on
 * déclenche un rechargement complet, au plus une fois toutes les 15
 * secondes (sessionStorage, par onglet) pour ne jamais boucler indéfiniment
 * si l'erreur persiste pour une autre raison (vraie panne réseau, par
 * exemple) — tout en restant capable de se redéclencher plus tard si
 * l'onglet survit à un déploiement suivant.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    function relancerSiNecessaire(message: string | undefined) {
      if (!estErreurDeChunkPerime(message)) return;
      let dernierEssai = 0;
      try {
        dernierEssai = Number(sessionStorage.getItem(CLE_RELANCE) || 0);
      } catch {
        // Stockage bloqué (navigation privée stricte) — on continue sans
        // garde anti-boucle plutôt que de laisser l'écran figé sans rien
        // faire ; au pire un rechargement redondant, jamais pire que l'état
        // actuel.
      }
      if (Date.now() - dernierEssai < FENETRE_MS) return;
      try {
        sessionStorage.setItem(CLE_RELANCE, String(Date.now()));
      } catch {
        // Idem ci-dessus.
      }
      window.location.reload();
    }

    function surErreur(e: ErrorEvent) {
      relancerSiNecessaire(e.message);
    }
    function surRejetNonGere(e: PromiseRejectionEvent) {
      relancerSiNecessaire(e.reason instanceof Error ? e.reason.message : String(e.reason));
    }

    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejetNonGere);
    return () => {
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejetNonGere);
    };
  }, []);

  return null;
}
