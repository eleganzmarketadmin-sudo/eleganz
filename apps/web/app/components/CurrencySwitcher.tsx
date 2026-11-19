"use client";

import { useDisplayCurrency, type DeviseAffichage } from "../lib/display-currency";
import styles from "./CurrencySwitcher.module.css";

const LIBELLES: Record<DeviseAffichage, string> = {
  USD: "USD ($)",
  CDF: "CDF (FC)",
};

/**
 * Sélecteur de devise d'affichage (19 nov. 2026, demande du propriétaire,
 * point 3) — un seul composant partagé par les quatre espaces (Marketplace,
 * Gestion, Centre de pilotage, livreur, comptable, institutions), à côté de
 * LanguageSwitcher/ThemeToggle dans chaque en-tête. Décision du propriétaire
 * (AskUserQuestion) : "Tout le monde" peut choisir sa propre devise, pas
 * seulement le Centre de pilotage.
 *
 * Ne change jamais un montant enregistré — seulement comment il est
 * présenté (voir lib/display-currency.tsx).
 */
export function CurrencySwitcher() {
  const { devise, definirDevise } = useDisplayCurrency();

  return (
    <select
      className={styles.select}
      value={devise}
      onChange={(e) => definirDevise(e.target.value as DeviseAffichage)}
      aria-label="Devise d'affichage des montants"
      title="Devise d'affichage des montants"
    >
      <option value="USD">{LIBELLES.USD}</option>
      <option value="CDF">{LIBELLES.CDF}</option>
    </select>
  );
}
