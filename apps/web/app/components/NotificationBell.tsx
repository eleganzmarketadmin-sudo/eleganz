"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./NotificationBell.module.css";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const INTERVALLE_SONDAGE_MS = 30_000;

/**
 * Cloche de notifications (demande UX du 15 oct. 2026, point 7) — partagée
 * par tous les espaces authentifiés (admin, vendeur/comptable/acheteur,
 * livreur). Sondage (polling) toutes les 30s plutôt qu'un flux temps réel :
 * même choix que le reste de la plateforme (pas de websocket), suffisant
 * pour "recevoir rapidement" sans ouvrir un nouveau canal d'infrastructure.
 * Le seul interrupteur global ("centre de pilotage peut désactiver") vit
 * côté serveur dans NotificationsService — ce composant n'a pas à le
 * connaître, il affiche simplement ce que l'API lui renvoie.
 */
// Chaque espace a sa propre page de messagerie (jeton séparé pour admin et
// livreur — voir espaceAuth() dans api.ts), donc le lien "voir tout" du
// panneau doit pointer vers celle de l'espace courant plutôt qu'une URL
// fixe. Mon Comptable a aussi sa propre page (ses comptes n'ont pas
// toujours de boutique, donc pas accès à /messagerie côté Gestion).
function cheminMessagerie(pathname: string | null): string {
  if (pathname?.startsWith("/admin")) return "/admin/messagerie";
  if (pathname?.startsWith("/livreur")) return "/livreur/messagerie";
  if (pathname?.startsWith("/comptable")) return "/comptable/messagerie";
  if (pathname?.startsWith("/marketplace")) return "/marketplace/messagerie";
  return "/messagerie";
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const [nonLues, setNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);

  const rafraichirCompteur = useCallback(async () => {
    try {
      const res = await api.get<{ nonLues: number }>("/notifications/compteur");
      setNonLues(res.nonLues);
    } catch (err) {
      // Une 401 passagère (jeton en cours de rafraîchissement) ne doit pas
      // casser l'affichage — on retentera au prochain sondage.
      if (!(err instanceof ApiError)) throw err;
    }
  }, []);

  useEffect(() => {
    rafraichirCompteur();
    const minuteur = setInterval(rafraichirCompteur, INTERVALLE_SONDAGE_MS);
    return () => clearInterval(minuteur);
  }, [rafraichirCompteur]);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    if (ouvert) document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  async function ouvrirPanneau() {
    const prochainEtat = !ouvert;
    setOuvert(prochainEtat);
    if (prochainEtat) {
      try {
        const liste = await api.get<Notification[]>("/notifications");
        setNotifications(liste);
      } catch {
        setNotifications([]);
      }
    }
  }

  async function surClicNotification(n: Notification) {
    setOuvert(false);
    if (!n.readAt) {
      setNonLues((v) => Math.max(0, v - 1));
      api.patch(`/notifications/${n.id}/lue`).catch(() => {});
    }
    if (n.link) {
      // Le lien stocké par l'API est générique ("/messagerie") car elle ne
      // connaît pas l'espace (admin/livreur/Mon Comptable/Gestion) dans
      // lequel le destinataire va le lire — on le fait pointer vers la
      // page de messagerie de l'espace courant plutôt que de suivre l'URL
      // telle quelle, qui n'existerait pas dans tous les espaces.
      const chemin = n.link === "/messagerie" ? cheminMessagerie(pathname) : n.link;
      router.push(chemin);
    }
  }

  async function toutMarquerLu() {
    setNonLues(0);
    setNotifications((liste) => liste?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    api.post("/notifications/tout-marquer-lu").catch(() => {});
  }

  return (
    <div className={styles.conteneur} ref={conteneurRef}>
      <button
        type="button"
        className={styles.cloche}
        onClick={ouvrirPanneau}
        aria-label={t("nav_notifications")}
        aria-expanded={ouvert}
      >
        🔔
        {nonLues > 0 && <span className={styles.badge}>{nonLues > 9 ? "9+" : nonLues}</span>}
      </button>
      {ouvert && (
        <div className={styles.panneau} role="menu">
          <div className={styles.entetePanneau}>
            <span>{t("nav_notifications")}</span>
            {nonLues > 0 && (
              <button type="button" className={styles.lienAction} onClick={toutMarquerLu}>
                {t("notif_toutMarquerLu")}
              </button>
            )}
          </div>
          <div className={styles.liste}>
            {notifications === null && <p className={styles.vide}>…</p>}
            {notifications?.length === 0 && <p className={styles.vide}>{t("notif_aucune")}</p>}
            {notifications?.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`${styles.item} ${!n.readAt ? styles.itemNonLu : ""}`}
                onClick={() => surClicNotification(n)}
              >
                <span className={styles.itemTitre}>{n.title}</span>
                <span className={styles.itemCorps}>{n.body}</span>
              </button>
            ))}
          </div>
          <Link className={styles.voirTout} href={cheminMessagerie(pathname)} onClick={() => setOuvert(false)}>
            {t("notif_voirTout")}
          </Link>
        </div>
      )}
    </div>
  );
}
