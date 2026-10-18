"use client";

import { InputHTMLAttributes, useState } from "react";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./ChampMotDePasse.module.css";

// Champ mot de passe avec œil de visibilité (17 oct. 2026, demande client
// après le test du canal email de réinitialisation : "l'œil à côté
// permettant une vérification de saisie n'est pas disponible prière le
// rajouter à tous les menus et champs de saisie de mot de passe pour toute
// la plateforme"). Composant unique réutilisé partout (connexion,
// inscription, mot de passe oublié) pour garder le même comportement et la
// même icône sur toute la plateforme plutôt que de dupliquer la logique
// dans chaque page. S'insère dans n'importe quel `.champ` existant : le
// wrapper ne casse pas les sélecteurs CSS `.champ input` déjà en place
// (toujours un input descendant), seul un padding-right est ajouté en
// ligne pour laisser la place à l'icône.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "style">;

export function ChampMotDePasse({ className, ...props }: Props) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.conteneur}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className}
        style={{ paddingRight: "44px", width: "100%" }}
      />
      <button
        type="button"
        className={styles.bouton}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("compte_masquerMotDePasse") : t("compte_afficherMotDePasse")}
        aria-pressed={visible}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.17 5.23A10.7 10.7 0 0 1 12 5c6 0 9.5 6 9.5 7a12.9 12.9 0 0 1-3.17 3.88M6.6 6.6C3.9 8.3 2.5 11 2.5 12c0 1 3.5 7 9.5 7 1.26 0 2.42-.27 3.46-.72"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
