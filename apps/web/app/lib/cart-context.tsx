"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { prixUnitaireEffectif, type PaliersPrix } from "./price-tiers";

export interface LigneDuPanier {
  variantId: string;
  productName: string;
  shopName: string;
  size?: string | null;
  color?: string | null;
  // Prix normal (sans remise de gros) — gardé séparément de `unitPrice` pour
  // pouvoir recalculer ce dernier à chaque changement de quantité (2 nov.
  // 2026, prix de gros par palier).
  basePrice: number;
  priceTiers?: PaliersPrix[];
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
        return prev.map((l) => {
          if (l.variantId !== ligne.variantId) return l;
          const nouvelleQuantite = Math.min(l.quantity + quantite, l.stockDisponible);
          return {
            ...l,
            quantity: nouvelleQuantite,
            unitPrice: prixUnitaireEffectif(nouvelleQuantite, l.basePrice, l.priceTiers),
          };
        });
      }
      const nouvelleQuantite = Math.min(quantite, ligne.stockDisponible);
      return [
        ...prev,
        {
          ...ligne,
          quantity: nouvelleQuantite,
          unitPrice: prixUnitaireEffectif(nouvelleQuantite, ligne.basePrice, ligne.priceTiers),
        },
      ];
    });
  }, []);

  // Recalcule le prix unitaire effectif à chaque changement de quantité
  // (2 nov. 2026, prix de gros par palier) — l'affichage du panier reste
  // ainsi toujours cohérent avec ce que la commande facturera réellement.
  const modifierQuantite = useCallback((variantId: string, quantite: number) => {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.variantId !== variantId) return l;
        const nouvelleQuantite = Math.max(1, Math.min(quantite, l.stockDisponible));
        return {
          ...l,
          quantity: nouvelleQuantite,
          unitPrice: prixUnitaireEffectif(nouvelleQuantite, l.basePrice, l.priceTiers),
        };
      }),
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
