"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./ThemeToggle.module.css";

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
 *
 * `etiquette` (21 nov. 2026, polissage des volets mobiles d'en-tête) : rend
 * le bouton comme une ligne de menu pleine largeur avec son libellé visible
 * ("Mode sombre"/"Mode clair") au lieu d'une icône carrée isolée — pour
 * s'intégrer proprement aux volets "options" repliables de chaque coquille.
 * N'affecte pas l'usage normal en en-tête (icône seule, comportement et
 * taille inchangés).
 */
export function ThemeToggle({ clair, etiquette }: { clair?: boolean; etiquette?: boolean }) {
  const { t } = useLocale();
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

  // Auparavant codées en dur en français (aria-label/title) — reprises ici
  // en clés i18n au passage, puisque le libellé devient maintenant visible
  // (et non plus seulement un attribut d'accessibilité) dans le volet
  // options de chaque coquille.
  const libelleProchainTheme = theme === "dark" ? t("theme_modeClair") : t("theme_modeSombre");

  // `etiquette` passe par des classes CSS plutôt qu'un style inline (voir
  // ThemeToggle.module.css) : seules des classes peuvent être conditionnées
  // par un @media, nécessaire ici pour que ce bouton reste le carré 40×40
  // habituel sur desktop/tablette et ne devienne une ligne de menu pleine
  // largeur qu'au point de rupture mobile, à l'intérieur du volet "options"
  // repliable de chaque coquille. L'usage normal (hors `etiquette`) garde
  // le style inline d'origine, inchangé.
  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={libelleProchainTheme}
      title={libelleProchainTheme}
      className={etiquette ? `${styles.bouton} ${clair ? styles.boutonClair : ""}` : undefined}
      style={
        etiquette
          ? undefined
          : {
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
            }
      }
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      {etiquette && <span className={styles.libelle}>{libelleProchainTheme}</span>}
    </button>
  );
}
