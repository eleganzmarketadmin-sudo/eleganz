"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, Locale, LOCALES, REVUE_RECOMMANDEE, TRANSLATIONS } from "./translations";

// Clé historique "eleganz_comptable_locale" conservée en lecture pour ne pas
// perdre la préférence déjà enregistrée par les utilisateurs de Mon
// Comptable lors de la généralisation du sélecteur à toute la plateforme
// (15 oct. 2026) — la nouvelle clé partagée est utilisée pour toute
// nouvelle écriture.
const CLE_STOCKAGE = "eleganz_locale";
const CLE_STOCKAGE_HERITEE = "eleganz_comptable_locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (cle: string) => string;
  reviewRecommended: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Choix de langue pour toute la plateforme (prompt §21 + réponse du
 * propriétaire du 13 oct. 2026 ; généralisé à Admin/Gestion/Marketplace le
 * 15 oct. 2026 — n'était auparavant monté que dans Secourable) —
 * maintenant monté une seule fois à la racine (`app/layout.tsx`), mémorisé
 * par navigateur comme le thème clair/sombre (ThemeToggle.tsx), jamais
 * envoyé au serveur : ce n'est pas une donnée métier et ça évite de
 * complexifier l'API pour un confort d'affichage. Seuls les menus/titres/
 * boutons sont traduits (voir translations.ts) ; les données saisies par
 * l'utilisateur restent dans leur langue d'origine.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stocke =
        (window.localStorage.getItem(CLE_STOCKAGE) as Locale | null) ??
        (window.localStorage.getItem(CLE_STOCKAGE_HERITEE) as Locale | null);
      if (stocke && LOCALES.some((l) => l.code === stocke)) setLocaleState(stocke);
    } catch {
      // stockage indisponible (navigation privée) — on reste sur le français
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, l);
    } catch {
      // stockage indisponible — le choix ne survivra pas au rechargement
    }
  }, []);

  const t = useCallback(
    (cle: string): string => {
      return TRANSLATIONS[locale]?.[cle] ?? TRANSLATIONS[DEFAULT_LOCALE][cle] ?? cle;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, reviewRecommended: REVUE_RECOMMANDEE.includes(locale) }),
    [locale, setLocale, t],
  );

  const langueCourante = LOCALES.find((l) => l.code === locale);

  return (
    <LocaleContext.Provider value={value}>
      <div dir={langueCourante?.rtl ? "rtl" : "ltr"}>{children}</div>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale doit être utilisé à l'intérieur de LocaleProvider.");
  return ctx;
}
