"use client";

import Link from "next/link";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./BoutonAccueilPlateforme.module.css";

/**
 * Bouton bien visible "Retour à l'accueil" pour les écrans de connexion/
 * inscription autonomes (Gestion, Centre de pilotage, Livreur) — signalé le
 * 2 nov. 2026 : ces pages n'ont pas d'en-tête de site (contrairement au
 * Marketplace, qui garde toujours son bandeau), donc un visiteur arrivé
 * directement sur /connexion (lien partagé, favori, mauvaise saisie) n'avait
 * aucun moyen de revenir à la page d'accueil de la plateforme (`/`) sans
 * utiliser le bouton "Précédent" du navigateur. Volontairement un vrai
 * bouton visible (fond + bordure), pas juste un lien texte discret comme
 * `RetourLien` — c'est le tout premier élément de la page, avant même le
 * titre de la marque.
 */
export function BoutonAccueilPlateforme() {
  const { t } = useLocale();
  return (
    <Link href="/" className={styles.bouton}>
      <span aria-hidden="true">←</span> {t("accueil_retourPlateforme")}
    </Link>
  );
}
