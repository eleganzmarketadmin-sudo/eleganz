"use client";

/**
 * Client HTTP vers l'API ELEGANZ (apps/api, NestJS).
 *
 * L'URL de base vient de NEXT_PUBLIC_API_URL (définie au déploiement) et
 * retombe sur localhost:3001 en développement local. Le jeton JWT est gardé
 * en mémoire + localStorage côté client ; aucune donnée commerciale n'est
 * mise en cache ici, seulement le jeton.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_KEY_DEFAUT = "eleganz_token";
const TOKEN_KEY_ADMIN = "eleganz_admin_token";
const TOKEN_KEY_LIVREUR = "eleganz_livreur_token";

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Gestion/Marketplace/acheteur, Centre de pilotage et Espace livreur
 * partagent le même domaine Next.js, donc le même `localStorage` — avec une
 * seule clé de jeton, se connecter dans un espace écrasait silencieusement
 * la session d'un autre espace ouvert dans un autre onglet, avec un symptôme
 * trompeur : l'écran restait affiché (état React déjà en mémoire) alors que
 * chaque appel API repartait avec le jeton du mauvais compte et échouait en
 * 403 (bug du 12 oct. 2026, d'abord corrigé entre Gestion et admin). Trois
 * clés séparées, choisies selon le préfixe d'URL, pour que les trois espaces
 * cohabitent sans se marcher dessus.
 */
export function espaceAuth(): "admin" | "livreur" | "defaut" {
  if (typeof window === "undefined") return "defaut";
  const chemin = window.location.pathname;
  // `startsWith` seul confondait l'espace livreur plateforme (/livreur/...)
  // avec la page Livreurs d'ELEGANZ Gestion (/livreurs, 13 oct. 2026) : cette
  // dernière partageait alors silencieusement le jeton de l'espace livreur
  // (vide), si bien que tous ses appels API échouaient sans jeton valable.
  // On exige maintenant une frontière de segment après "/admin"/"/livreur".
  if (chemin === "/admin" || chemin.startsWith("/admin/")) return "admin";
  if (chemin === "/livreur" || chemin.startsWith("/livreur/")) return "livreur";
  return "defaut";
}

function cleJeton(espace: "admin" | "livreur" | "defaut" = espaceAuth()): string {
  if (espace === "admin") return TOKEN_KEY_ADMIN;
  if (espace === "livreur") return TOKEN_KEY_LIVREUR;
  return TOKEN_KEY_DEFAUT;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cleJeton());
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const cle = cleJeton();
    if (token) {
      window.localStorage.setItem(cle, token);
    } else {
      window.localStorage.removeItem(cle);
    }
  } catch {
    // stockage indisponible (navigation privée) — on continue sans persister
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur ELEGANZ. Vérifiez votre connexion et réessayez.",
      0,
    );
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message ?? "Une erreur est survenue.";
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "PATCH", body, auth }),
  delete: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "DELETE", body, auth }),
};
