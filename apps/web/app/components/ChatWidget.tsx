"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { MessagerieEcran } from "./MessagerieEcran";
import styles from "./ChatWidget.module.css";

// Même logique que NotificationBell.cheminMessagerie, dupliquée volontairement
// ici (petite fonction pure, pas de bénéfice à la partager entre deux
// composants qui ne se chargent jamais ensemble dans le même rendu critique).
function cheminMessagerie(pathname: string | null): string {
  if (pathname?.startsWith("/admin")) return "/admin/messagerie";
  if (pathname?.startsWith("/livreur")) return "/livreur/messagerie";
  if (pathname?.startsWith("/comptable")) return "/comptable/messagerie";
  if (pathname?.startsWith("/marketplace")) return "/marketplace/messagerie";
  return "/messagerie";
}

/**
 * Chatbox native (demande UX du 15 oct. 2026, point 3 : "vous n'avez pas
 * prevu de chatbox... pour garder une interaction et recevoir les messages
 * rapidement"). Bulle flottante visible dans tous les espaces authentifiés,
 * qui ouvre un panneau compact réutilisant MessagerieEcran — pas une
 * fonctionnalité séparée, juste un accès plus rapide au même centre de
 * messagerie que la page dédiée. Contrôlée globalement depuis le Centre de
 * pilotage (PlatformSettings.chatWidgetEnabled, lu publiquement).
 */
export function ChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [actif, setActif] = useState(true);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    api
      .get<{ chatWidgetEnabled: boolean }>("/platform-settings/features", false)
      .then((d) => setActif(d.chatWidgetEnabled))
      .catch(() => setActif(true));
  }, []);

  if (!user || !actif) return null;

  return (
    <div className={styles.conteneur}>
      {ouvert && (
        <div className={styles.panneau} role="dialog" aria-label="Messagerie">
          <div className={styles.entete}>
            <span>Messagerie</span>
            <div className={styles.enteteActions}>
              <Link href={cheminMessagerie(pathname)} className={styles.lienPlein} onClick={() => setOuvert(false)}>
                Plein écran
              </Link>
              <button type="button" className={styles.fermer} onClick={() => setOuvert(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
          </div>
          <div className={styles.corps}>
            <MessagerieEcran compact />
          </div>
        </div>
      )}
      <button
        type="button"
        className={styles.bulle}
        onClick={() => setOuvert((v) => !v)}
        aria-label={ouvert ? "Fermer la messagerie" : "Ouvrir la messagerie"}
      >
        {ouvert ? "✕" : "💬"}
      </button>
    </div>
  );
}
