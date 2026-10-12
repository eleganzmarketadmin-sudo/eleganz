"use client";

import { getToken } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Télécharge un fichier protégé par jeton (export Excel, gabarit…) en le
 * récupérant nous-mêmes puis en déclenchant un téléchargement — même
 * contrainte que pour les PDF (lib/pdf.ts) : un <a href> simple ne peut pas
 * porter l'en-tête Authorization.
 */
export async function telechargerFichier(path: string, nomParDefaut: string): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error("Impossible de joindre le serveur ELEGANZ. Vérifiez votre connexion et réessayez.");
  }

  if (!res.ok) {
    const texte = await res.text().catch(() => "");
    let message = "Le fichier n'a pas pu être généré.";
    try {
      const data = texte ? JSON.parse(texte) : null;
      if (data?.message) message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    } catch {
      // réponse non-JSON — message générique conservé
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const nomDepuisEntete = res.headers
    .get("Content-Disposition")
    ?.match(/filename="?([^";]+)"?/)?.[1];

  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = nomDepuisEntete || nomParDefaut;
  window.document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Envoie un fichier (ex. classeur Excel) en multipart/form-data — l'API
 * d'`api.ts` n'est faite que pour du JSON, donc ce cas particulier passe par
 * son propre `fetch`, comme `ouvrirDocumentPdf`.
 */
export async function envoyerFichier<T>(path: string, fichier: File, champ = "fichier"): Promise<T> {
  const token = getToken();
  const corps = new FormData();
  corps.append(champ, fichier);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: corps,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur ELEGANZ. Vérifiez votre connexion et réessayez.");
  }

  const texte = await res.text();
  const data = texte ? JSON.parse(texte) : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message ?? "Le fichier n'a pas pu être traité.";
    throw new Error(message);
  }

  return data as T;
}
