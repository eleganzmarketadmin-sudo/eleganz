"use client";

import { useEffect, useState } from "react";

const CLE_STOCKAGE = "eleganz_theme";

type Theme = "light" | "dark";

/**
 * Script injecté en tête de page (voir layout.tsx) : lit le choix enregistré
 * AVANT le premier rendu pour éviter le flash d'un mauvais thème. S'exécute
 * en synchrone, jamais en React — react n'est pas encore monté à ce moment.
 */
export const SCRIPT_INIT_THEME = `
(function () {
  try {
    var stocke = localStorage.getItem("${CLE_STOCKAGE}");
    if (stocke === "dark" || stocke === "light") {
      document.documentElement.setAttribute("data-theme", stocke);
    }
  } catch (e) {}
})();
`;

function themeActuel(): Theme {
  if (typeof document === "undefined") return "light";
  const attribut = document.documentElement.getAttribute("data-theme");
  if (attribut === "dark" || attribut === "light") return attribut;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/**
 * Interrupteur clair/sombre — un seul composant partagé par les trois
 * interfaces (Gestion, Marketplace, Centre de pilotage). Le choix est
 * mémorisé par navigateur (prompt §§ confort d'usage), jamais envoyé au
 * serveur : ce n'est pas une donnée métier.
 */
export function ThemeToggle({ clair }: { clair?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(themeActuel());
  }, []);

  function basculer() {
    const prochain: Theme = theme === "dark" ? "light" : "dark";
    setTheme(prochain);
    document.documentElement.setAttribute("data-theme", prochain);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, prochain);
    } catch {
      // stockage indisponible (navigation privée) — le choix ne survivra pas au rechargement
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
      style={{
        background: "none",
        border: `1px solid ${clair ? "rgba(255,255,255,0.4)" : "var(--color-border-forte)"}`,
        color: clair ? "#fff" : "var(--color-ink)",
        width: 40,
        height: 40,
        minHeight: 40,
        minWidth: 40,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: "1.1rem",
        lineHeight: 1,
        padding: 0,
      }}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
