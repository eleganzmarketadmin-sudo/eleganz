"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { api, ApiError, espaceAuth, getToken, setToken } from "./api";
import { useDeconnexionInactivite } from "./useDeconnexionInactivite";

export interface AuthUser {
  id: string;
  role: string;
}

export interface InscriptionInfos {
  fullName: string;
  identifiant: string; // email ou téléphone
  motDePasse: string;
  role?: "SHOP_OWNER" | "BUYER" | "DRIVER";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifiant: string, motDePasse: string, espace?: "admin" | "livreur" | "gestion" | "comptable") => Promise<void>;
  register: (infos: InscriptionInfos) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Décode la charge utile d'un JWT côté client, uniquement pour afficher
 * l'écran adapté au rôle (ex. masquer la marge à un caissier). Ce n'est
 * jamais la source de vérité des droits : chaque appel API est revérifié
 * côté serveur par JwtAuthGuard / ShopMembershipGuard, qui ignorent tout ce
 * que le front prétend.
 */
function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!json.sub || !json.role) return null;
    return { id: json.sub, role: json.role };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const espace = espaceAuth();

  // Relit le jeton (et donc l'utilisateur) à chaque changement d'espace —
  // Gestion/Marketplace d'un côté, Centre de pilotage (/admin) de l'autre,
  // chacun avec sa propre clé de stockage (voir api.ts). Sans ça, naviguer
  // de l'un vers l'autre en navigation côté client (sans rechargement
  // complet) laissait l'état React affiché périmé.
  useEffect(() => {
    const token = getToken();
    setUser(token ? decodeJwtPayload(token) : null);
    setLoading(false);
  }, [espace, pathname]);

  // Synchronise entre onglets du même espace : si l'utilisateur se
  // reconnecte (ou se déconnecte) dans un autre onglet ouvert sur le même
  // espace, cet onglet-ci ne doit pas continuer d'afficher un état périmé.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== null && !e.key.startsWith("eleganz_")) return;
      const token = getToken();
      setUser(token ? decodeJwtPayload(token) : null);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // `espace` (demande du 10 nov. 2026, point 5) : transmis par la page de
  // connexion dédiée (admin/livreur/gestion) pour que le serveur refuse la
  // connexion — sans émettre de jeton — si le rôle du compte ne correspond
  // pas à cet espace. Omis par /marketplace/compte (Marketplace + "Mon
  // assistant"/Secourable), qui reste ouvert à tout compte ELEGANZ.
  const login = useCallback(
    async (identifiant: string, motDePasse: string, espace?: "admin" | "livreur" | "gestion" | "comptable") => {
      const estEmail = identifiant.includes("@");
      const { accessToken } = await api.post<{ accessToken: string }>(
        "/auth/login",
        {
          ...(estEmail ? { email: identifiant } : { phone: identifiant }),
          password: motDePasse,
          ...(espace ? { espace } : {}),
        },
        false,
      );
      setToken(accessToken);
      setUser(decodeJwtPayload(accessToken));
    },
    [],
  );

  const register = useCallback(
    async ({ fullName, identifiant, motDePasse, role = "SHOP_OWNER" }: InscriptionInfos) => {
      const estEmail = identifiant.includes("@");
      const { accessToken } = await api.post<{ accessToken: string }>(
        "/auth/register",
        {
          fullName,
          password: motDePasse,
          role,
          ...(estEmail ? { email: identifiant } : { phone: identifiant }),
        },
        false,
      );
      setToken(accessToken);
      setUser(decodeJwtPayload(accessToken));
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Déconnexion automatique après inactivité prolongée (signalement du
  // 11 nov. 2026) — branchée ici une seule fois plutôt que dans chaque
  // coquille d'espace (GestionShell, AdminShell...) : couvre les quatre
  // espaces d'un coup, chacun avec son propre horodatage (clé par `espace`).
  useDeconnexionInactivite(espace, !!user, logout);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.");
  return ctx;
}

export { ApiError };
