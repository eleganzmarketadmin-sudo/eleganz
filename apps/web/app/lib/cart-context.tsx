"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface LigneDuPanier {
  variantId: string;
  productName: string;
  shopName: string;
  size?: string | null;
  color?: string | null;
  unitPrice: number;
  currency: string;
  quantity: number;
  stockDisponible: number;
}

interface CartContextValue {
  lignes: LigneDuPanier[];
  ajouter: (ligne: Omit<LigneDuPanier, "quantity">, quantite: number) => void;
  modifierQuantite: (variantId: string, quantite: number) => void;
  retirer: (variantId: string) => void;
  vider: () => void;
  total: number;
  devise: string;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "eleganz_panier";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lignes, setLignes] = useState<LigneDuPanier[]>([]);

  useEffect(() => {
    try {
      const sauvegarde = window.localStorage.getItem(STORAGE_KEY);
      if (sauvegarde) setLignes(JSON.parse(sauvegarde));
    } catch {
      // panier vide par défaut si le stockage est indisponible
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lignes));
    } catch {
      // le panier reste fonctionnel en mémoire même sans persistance
    }
  }, [lignes]);

  const ajouter = useCallback((ligne: Omit<LigneDuPanier, "quantity">, quantite: number) => {
    setLignes((prev) => {
      const existante = prev.find((l) => l.variantId === ligne.variantId);
      if (existante) {
        return prev.map((l) =>
          l.variantId === ligne.variantId
            ? { ...l, quantity: Math.min(l.quantity + quantite, l.stockDisponible) }
            : l,
        );
      }
      return [...prev, { ...ligne, quantity: Math.min(quantite, ligne.stockDisponible) }];
    });
  }, []);

  const modifierQuantite = useCallback((variantId: string, quantite: number) => {
    setLignes((prev) =>
      prev.map((l) =>
        l.variantId === variantId
          ? { ...l, quantity: Math.max(1, Math.min(quantite, l.stockDisponible)) }
          : l,
      ),
    );
  }, []);

  const retirer = useCallback((variantId: string) => {
    setLignes((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const vider = useCallback(() => setLignes([]), []);

  const total = lignes.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const devise = lignes[0]?.currency ?? "USD";

  const value = useMemo(
    () => ({ lignes, ajouter, modifierQuantite, retirer, vider, total, devise }),
    [lignes, ajouter, modifierQuantite, retirer, vider, total, devise],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé à l'intérieur de <CartProvider>.");
  return ctx;
}
