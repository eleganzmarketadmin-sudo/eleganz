"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité ultime (12 nov. 2026, signalement "page de connexion
 * figée" : "l'écran flashe et revient comme si on n'avait pas cliqué... et
 * aucun message d'erreur"). Avant ce fichier, AUCUNE page d'erreur n'existait
 * nulle part sur la plateforme — si un composant plante pendant le rendu
 * (y compris dans un layout, comme ShopProvider/OfflineSyncProvider pour le
 * module Gestion), React/Next.js n'a rien à afficher : résultat un écran
 * vide, sans le moindre message, exactement le symptôme rapporté. Ce fichier
 * doit redéfinir <html>/<body> lui-même (il remplace le layout racine
 * lorsqu'il se déclenche), et ne capture QUE les erreurs du layout racine —
 * voir aussi (gestion)/error.tsx pour les erreurs propres aux pages Gestion.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#15171c",
            color: "#f0efe9",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Un problème est survenu</h1>
          <p style={{ maxWidth: "440px", margin: 0, opacity: 0.85 }}>
            Quelque chose s&apos;est mal passé pendant le chargement de la page. Ce n&apos;est pas
            forcément lié à vos identifiants — réessayez, et si le problème persiste, signalez-le
            avec l&apos;heure exacte.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              background: "#a62368",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
