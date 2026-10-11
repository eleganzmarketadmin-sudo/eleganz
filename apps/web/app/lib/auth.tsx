"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";

export interface AuthUser {
  id: string;
  role: string;
}

export interface InscriptionInfos {
  fullName: string;
  identifiant: string; // email ou téléphone
  motDePasse: string;
  role?: "SHOP_OWNER" | "BUYER";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifiant: string, motDePasse: string) => Promise<void>;
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

  useEffect(() => {
    const token = getToken();
    if (token) setUser(decodeJwtPayload(token));
    setLoading(false);
  }, []);

  const login = useCallback(async (identifiant: string, motDePasse: string) => {
    const estEmail = identifiant.includes("@");
    const { accessToken } = await api.post<{ accessToken: string }>(
      "/auth/login",
      estEmail
        ? { email: identifiant, password: motDePasse }
        : { phone: identifiant, password: motDePasse },
      false,
    );
    setToken(accessToken);
    setUser(decodeJwtPayload(accessToken));
  }, []);

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
