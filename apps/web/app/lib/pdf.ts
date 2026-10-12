"use client";

import { getToken } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Ouvre un document PDF protégé par jeton dans un nouvel onglet. Un simple
 * lien <a href> ne peut pas porter l'en-tête Authorization, donc on
 * récupère le PDF nous-mêmes et on ouvre l'URL mémoire obtenue.
 *
 * Point important : la fenêtre doit être ouverte de façon SYNCHRONE, dans le
 * même tick que le clic — pas après un `await fetch(...)`. Beaucoup de
 * navigateurs (Safari iOS, webviews Android, Chrome en mode strict) ne
 * considèrent un `window.open()` comme déclenché par un geste utilisateur
 * que s'il survient avant la première pause asynchrone ; appelé après un
 * `await`, il est bloqué silencieusement (ou lève une erreur dans certains
 * webviews), ce qui provoquait l'échec « le ticket n'a pas pu être ouvert
 * pour impression ». On ouvre donc un onglet vide tout de suite, puis on y
 * pointe l'URL du PDF une fois prêt. Si même ça échoue (bloqueur de popup
 * très strict), on retombe sur un téléchargement direct du fichier.
 */
export async function ouvrirDocumentPdf(path: string): Promise<void> {
  let fenetre: Window | null = null;
  try {
    fenetre = window.open("", "_blank");
  } catch {
    fenetre = null;
  }

  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    fenetre?.close();
    throw new Error(
      "Impossible de joindre le serveur ELEGANZ pour générer le document. Vérifiez votre connexion et réessayez.",
    );
  }

  if (!res.ok) {
    fenetre?.close();
    const texte = await res.text().catch(() => "");
    let message = "Le document n'a pas pu être généré.";
    try {
      const data = texte ? JSON.parse(texte) : null;
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }
    } catch {
      // réponse non-JSON — on garde le message générique
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (fenetre && !fenetre.closed) {
    fenetre.location.href = url;
    return;
  }

  // Popup bloquée malgré l'ouverture synchrone (réglage navigateur très
  // strict, ou webview sans fenêtres secondaires) : on télécharge le fichier
  // directement plutôt que d'échouer silencieusement.
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = path.split("/").pop()?.replace(/[?#].*$/, "") || "document.pdf";
  window.document.body.appendChild(lien);
  lien.click();
  lien.remove();
}
