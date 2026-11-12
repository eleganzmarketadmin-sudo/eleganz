"use client";

import { useEffect } from "react";

/**
 * Filet de sécurité pour le module Gestion (12 nov. 2026, signalement "page
 * de connexion figée"). Capture toute erreur de rendu dans une page Gestion
 * (par ex. /caisse juste après la connexion) et affiche un message clair au
 * lieu d'un écran vide. Ne capture PAS les erreurs du layout du groupe
 * (gestion) lui-même (ShopProvider/OfflineSyncProvider) — celles-ci sont
 * couvertes par global-error.tsx à la racine.
 */
export default function GestionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[gestion/error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Un problème est survenu</h2>
      <p style={{ maxWidth: "440px", margin: 0, opacity: 0.85 }}>
        Quelque chose s&apos;est mal passé pendant le chargement de cette page. Réessayez, et si le
        problème persiste, signalez-le avec l&apos;heure exacte.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: "10px 20px",
          background: "var(--color-magenta, #a62368)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
