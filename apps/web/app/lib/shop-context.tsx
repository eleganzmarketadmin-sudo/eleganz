"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

export interface Shop {
  id: string;
  name: string;
  slug: string;
  mode: "PRIVATE" | "MARKETPLACE" | "HYBRID";
  status: string;
}

interface ShopContextValue {
  shops: Shop[];
  currentShop: Shop | null;
  loading: boolean;
  error: string | null;
  setCurrentShopId: (id: string) => void;
  reload: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);
const STORAGE_KEY = "eleganz_shop_id";

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setShops([]);
      setLoading(false);
      return;
    }
    let annule = false;
    setLoading(true);
    setError(null);
    api
      .get<Shop[]>("/shops/mine")
      .then((data) => {
        if (annule) return;
        setShops(data);
        const sauvegardee = window.localStorage.getItem(STORAGE_KEY);
        const valide = data.find((s) => s.id === sauvegardee);
        setCurrentShopIdState(valide ? valide.id : data[0]?.id ?? null);
      })
      .catch((err) => {
        if (!annule) setError(err instanceof Error ? err.message : "Erreur inconnue.");
      })
      .finally(() => {
        if (!annule) setLoading(false);
      });
    return () => {
      annule = true;
    };
  }, [user, reloadKey]);

  const setCurrentShopId = useCallback((id: string) => {
    setCurrentShopIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignoré — simple confort de navigation
    }
  }, []);

  const value = useMemo<ShopContextValue>(
    () => ({
      shops,
      currentShop: shops.find((s) => s.id === currentShopId) ?? null,
      loading,
      error,
      setCurrentShopId,
      reload: () => setReloadKey((k) => k + 1),
    }),
    [shops, currentShopId, loading, error, setCurrentShopId],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop doit être utilisé à l'intérieur de <ShopProvider>.");
  return ctx;
}
