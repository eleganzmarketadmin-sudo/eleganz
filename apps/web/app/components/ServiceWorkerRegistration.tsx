"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker de l'app shell (public/sw.js) — phase 2 du
 * mode hors-ligne (docs/ARCHITECTURE_HORS_LIGNE.md). Ne fait rien côté
 * serveur (rendu React) ni dans un navigateur sans support des service
 * workers : l'app continue de fonctionner normalement, juste sans
 * disponibilité hors-ligne de l'app shell.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec silencieux : l'app reste utilisable en ligne, seule la
      // disponibilité hors-ligne de l'app shell n'est pas activée.
    });
  }, []);

  return null;
}
