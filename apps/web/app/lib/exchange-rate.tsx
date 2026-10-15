"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { formatMoney } from "./money";

/**
 * Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) — un
 * seul taux pour toute la plateforme, piloté depuis le Centre de pilotage
 * (voir apps/api/src/admin-settings). Lu ici via l'endpoint public
 * GET /platform-settings/exchange-rate, sans authentification, pour que
 * Marketplace, Caisse et Secourable puissent tous l'utiliser.
 *
 * Phase 1 seulement : conversion "au taux du jour", pour l'affichage.
 * Jamais figé sur une vente/opération déjà enregistrée dans cette passe
 * (voir docs/PROJECT_STATUS.md pour la phase 2 envisagée).
 */

interface ExchangeRateContextValue {
  cdfPerUsd: number | null;
  updatedAt: string | null;
  convertir: (montant: number, de: string, vers: string) => number | null;
  /** "≈ 12.50 USD" ou "" si le taux n'est pas configuré — jamais une valeur inventée. */
  equivalent: (montant: number, de: string) => string;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

export function ExchangeRateProvider({ children }: { children: React.ReactNode }) {
  const [cdfPerUsd, setCdfPerUsd] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    api
      .get<{ cdfPerUsd: string | null; updatedAt: string | null }>("/platform-settings/exchange-rate", false)
      .then((d) => {
        if (annule) return;
        setCdfPerUsd(d.cdfPerUsd != null ? Number(d.cdfPerUsd) : null);
        setUpdatedAt(d.updatedAt);
      })
      .catch(() => {
        // Non bloquant : sans taux disponible, on affiche simplement les
        // montants sans équivalent, nulle part sur la plateforme.
      });
    return () => {
      annule = true;
    };
  }, []);

  const value = useMemo<ExchangeRateContextValue>(() => {
    function convertir(montant: number, de: string, vers: string): number | null {
      if (de === vers) return montant;
      if (cdfPerUsd == null) return null;
      if (de === "USD" && vers === "CDF") return montant * cdfPerUsd;
      if (de === "CDF" && vers === "USD") return montant / cdfPerUsd;
      return null;
    }
    function equivalent(montant: number, de: string): string {
      const vers = de === "USD" ? "CDF" : de === "CDF" ? "USD" : null;
      if (!vers) return "";
      const converti = convertir(montant, de, vers);
      if (converti == null) return "";
      return `≈ ${formatMoney(converti, vers)}`;
    }
    return { cdfPerUsd, updatedAt, convertir, equivalent };
  }, [cdfPerUsd, updatedAt]);

  return <ExchangeRateContext.Provider value={value}>{children}</ExchangeRateContext.Provider>;
}

export function useExchangeRate(): ExchangeRateContextValue {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) {
    throw new Error("useExchangeRate doit être utilisé à l'intérieur de <ExchangeRateProvider>.");
  }
  return ctx;
}
