"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useExchangeRate } from "./exchange-rate";
import { formatMoney } from "./money";

/**
 * Devise d'affichage (19 nov. 2026, demande du propriétaire, point 3) —
 * "donner la possibilité de choisir à partir de quelle devise les prix
 * seront affichés par l'utilisateur, également le choix de la devise à
 * afficher par défaut au niveau du centre de pilotage." Portée validée avec
 * le propriétaire (AskUserQuestion) : "Partout sur la plateforme" / "Tout le
 * monde" (boutiques, acheteurs, admin — chacun choisit sa propre devise).
 *
 * Trois niveaux, du plus fort au plus faible :
 *   1. Préférence personnelle de CE navigateur (localStorage, ci-dessous) ;
 *   2. À défaut, devise par défaut réglée au Centre de pilotage
 *      (PlatformSettings.defaultDisplayCurrency, lue via useExchangeRate()
 *      qui l'expose déjà — un seul appel réseau partagé, pas de doublon) ;
 *   3. À défaut (ni l'un ni l'autre disponible), "USD" en dur.
 *
 * Ceci ne change JAMAIS un montant déjà enregistré — uniquement comment il
 * est présenté à l'écran, convertion "au taux du jour" comme
 * ExchangeRateProvider (même limite Phase 1, voir exchange-rate.tsx).
 *
 * Pas de script d'avant-hydratation ici (contrairement à ThemeToggle/
 * SCRIPT_INIT_THEME) : ce script-là évite un flash visuel parce que le CSS
 * lit l'attribut data-theme indépendamment de React. Ici, rien ne consomme
 * la devise avant que React n'affiche le texte lui-même — un script
 * d'avant-hydratation n'apporterait donc aucun bénéfice réel, seulement de
 * la complexité (le montant lui-même dépend déjà du taux de change, chargé
 * de façon asynchrone par ExchangeRateProvider, donc un bref réaffichage
 * est de toute façon inévitable).
 */

const CLE_STOCKAGE = "eleganz_devise_affichage";

export type DeviseAffichage = "USD" | "CDF";

interface DisplayCurrencyContextValue {
  /** La devise à utiliser pour tout affichage de montant, partout sur la plateforme. */
  devise: DeviseAffichage;
  /** true si CE navigateur a enregistré son propre choix (sinon : défaut plateforme ou USD). */
  deviseEstPersonnalisee: boolean;
  /** Enregistre le choix personnel de ce navigateur. `null` = revenir au défaut plateforme. */
  definirDevise: (devise: DeviseAffichage | null) => void;
  /** Convertit `montant` (exprimé dans `deviseOrigine`) vers la devise d'affichage choisie, puis le formate. */
  formaterDansDeviseAffichage: (montant: number, deviseOrigine: string) => string;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);

function lirePreferenceStockee(): DeviseAffichage | null {
  try {
    const stocke = window.localStorage.getItem(CLE_STOCKAGE);
    if (stocke === "USD" || stocke === "CDF") return stocke;
  } catch {
    // stockage indisponible (navigation privée) — pas de préférence mémorisée
  }
  return null;
}

export function DisplayCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { convertir, defaultDisplayCurrency } = useExchangeRate();
  const [preferencePersonnelle, setPreferencePersonnelle] = useState<DeviseAffichage | null>(null);

  // Lu après montage seulement (comme ThemeToggle.themeActuel) : le rendu
  // serveur ne connaît jamais le localStorage du navigateur.
  useEffect(() => {
    setPreferencePersonnelle(lirePreferenceStockee());
  }, []);

  const value = useMemo<DisplayCurrencyContextValue>(() => {
    const devise = preferencePersonnelle ?? defaultDisplayCurrency;

    function definirDevise(nouvelle: DeviseAffichage | null) {
      setPreferencePersonnelle(nouvelle);
      try {
        if (nouvelle) window.localStorage.setItem(CLE_STOCKAGE, nouvelle);
        else window.localStorage.removeItem(CLE_STOCKAGE);
      } catch {
        // stockage indisponible — le choix ne survivra pas au rechargement, non bloquant
      }
    }

    function formaterDansDeviseAffichage(montant: number, deviseOrigine: string): string {
      if (deviseOrigine === devise) return formatMoney(montant, devise);
      const converti = convertir(montant, deviseOrigine, devise);
      // Taux pas encore configuré/chargé, ou devise d'origine ni USD ni CDF :
      // jamais inventer une conversion — on retombe sur la devise d'origine
      // plutôt que d'afficher un montant faux.
      if (converti == null) return formatMoney(montant, deviseOrigine);
      return formatMoney(converti, devise);
    }

    return {
      devise,
      deviseEstPersonnalisee: preferencePersonnelle !== null,
      definirDevise,
      formaterDansDeviseAffichage,
    };
  }, [preferencePersonnelle, defaultDisplayCurrency, convertir]);

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}

export function useDisplayCurrency(): DisplayCurrencyContextValue {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error("useDisplayCurrency doit être utilisé à l'intérieur de <DisplayCurrencyProvider>.");
  }
  return ctx;
}
