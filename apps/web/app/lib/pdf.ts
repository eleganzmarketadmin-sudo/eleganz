"use client";

import { getToken } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Ouvre un document PDF protégé par jeton dans un nouvel onglet. Un simple
 * lien <a href> ne peut pas porter l'en-tête Authorization, donc on
 * récupère le PDF nous-mêmes et on ouvre l'URL mémoire obtenue.
 */
export async function ouvrirDocumentPdf(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("Le document PDF n'a pas pu être généré.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
