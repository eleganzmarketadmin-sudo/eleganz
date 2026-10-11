"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import {
  listerOperationsEnAttente,
  marquerEchec,
  retirerOperation,
  type OperationEnAttente,
} from "./offline-queue";

interface OfflineSyncContextValue {
  nombreEnAttente: number;
  synchroniser: () => Promise<void>;
  rafraichirCompteur: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

const INTERVALLE_SYNC_MS = 30_000;

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const [enCours, setEnCours] = useState(false);

  const rafraichirCompteur = useCallback(async () => {
    try {
      const ops = await listerOperationsEnAttente();
      setNombreEnAttente(ops.length);
    } catch {
      // IndexedDB indisponible (navigation privée, navigateur ancien) —
      // le mode hors-ligne est alors simplement désactivé, pas bloquant.
    }
  }, []);

  const synchroniser = useCallback(async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      let ops: OperationEnAttente[];
      try {
        ops = await listerOperationsEnAttente();
      } catch {
        return;
      }

      for (const op of ops) {
        try {
          await api.post(`/shops/${op.shopId}/pos/sales/sync`, {
            ...(op.payload as Record<string, unknown>),
            clientOperationId: op.clientOperationId,
          });
          await retirerOperation(op.clientOperationId);
        } catch {
          // Échec (réseau coupé ou erreur serveur) : on arrête la boucle ici
          // pour garder l'ordre FIFO — les opérations suivantes attendront
          // la prochaine tentative plutôt que de passer devant celle-ci.
          await marquerEchec(op.clientOperationId, op);
          break;
        }
      }
    } finally {
      setEnCours(false);
      await rafraichirCompteur();
    }
  }, [enCours, rafraichirCompteur]);

  useEffect(() => {
    rafraichirCompteur();
    const intervalle = setInterval(() => {
      synchroniser();
    }, INTERVALLE_SYNC_MS);
    window.addEventListener("online", synchroniser);
    return () => {
      clearInterval(intervalle);
      window.removeEventListener("online", synchroniser);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ nombreEnAttente, synchroniser, rafraichirCompteur }),
    [nombreEnAttente, synchroniser, rafraichirCompteur],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync doit être utilisé à l'intérieur de <OfflineSyncProvider>.");
  }
  return ctx;
}
