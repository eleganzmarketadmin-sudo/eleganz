"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const CLE_REFUS_LOCAL = "eleganz_push_refuse";

/**
 * Convertit la clé VAPID publique (base64 URL-safe, telle que renvoyée par
 * GET /push/cle-publique) au format Uint8Array attendu par
 * PushManager.subscribe — conversion standard documentée par la spec Web
 * Push, aucune lib tierce nécessaire côté navigateur.
 */
function versUint8Array(base64UrlSafe: string): Uint8Array {
  const padding = "=".repeat((4 - (base64UrlSafe.length % 4)) % 4);
  const base64 = (base64UrlSafe + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(base64);
  const tableau = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) tableau[i] = brut.charCodeAt(i);
  return tableau;
}

type EtatPush = "indisponible" | "chargement" | "inactif" | "refuse" | "actif";

/**
 * Notifications push navigateur (10 nov. 2026, demande : être alerté sur le
 * téléphone/ordinateur à l'arrivée d'un message/d'une commande, avec
 * redirection au clic). Réutilise le service worker déjà enregistré par
 * ServiceWorkerRegistration (app shell hors-ligne) plutôt que d'en
 * enregistrer un second — un seul `/sw.js` couvre toute l'origine.
 *
 * "refuse" distingue le refus navigateur définitif (Notification.permission
 * === "denied", rien à faire ici — seuls les réglages du navigateur peuvent
 * le changer) d'un simple "pas encore activé" ("inactif") pour que
 * l'interface propose la bonne action dans chaque cas.
 */
export function usePushNotifications() {
  const [etat, setEtat] = useState<EtatPush>("chargement");

  const rafraichirEtat = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEtat("indisponible");
      return;
    }
    if (Notification.permission === "denied") {
      setEtat("refuse");
      return;
    }
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.getSubscription();
      setEtat(abonnement ? "actif" : "inactif");
    } catch {
      setEtat("indisponible");
    }
  }, []);

  useEffect(() => {
    rafraichirEtat();
  }, [rafraichirEtat]);

  const activer = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return false;
      }
      const { clePublique } = await api.get<{ clePublique: string | null }>("/push/cle-publique", false);
      if (!clePublique) {
        // Canal préparé mais pas encore configuré côté serveur (clés VAPID
        // absentes) — rien de cassé pour la personne, juste pas encore actif.
        setEtat("inactif");
        return false;
      }
      const enregistrement = await navigator.serviceWorker.ready;
      let abonnement = await enregistrement.pushManager.getSubscription();
      if (!abonnement) {
        abonnement = await enregistrement.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: versUint8Array(clePublique) as unknown as BufferSource,
        });
      }
      const json = abonnement.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      if (!json.keys) return false;
      await api.post("/push/abonnement", {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
      window.localStorage.removeItem(CLE_REFUS_LOCAL);
      setEtat("actif");
      return true;
    } catch {
      setEtat("inactif");
      return false;
    }
  }, []);

  const desactiver = useCallback(async (): Promise<void> => {
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (abonnement) {
        await api.delete("/push/abonnement", { endpoint: abonnement.endpoint });
        await abonnement.unsubscribe();
      }
    } catch {
      // best-effort : même en cas d'échec réseau, l'état local redevient
      // "inactif" ci-dessous, l'abonnement serveur orphelin sera purgé au
      // prochain envoi (voir PushSenderService, 404/410 -> suppression).
    }
    setEtat("inactif");
  }, []);

  /** Mémorise que la personne a explicitement refusé l'invite in-app (pas
   * le refus navigateur) — pour ne pas la lui reproposer à chaque visite. */
  const rejeterInvite = useCallback(() => {
    try {
      window.localStorage.setItem(CLE_REFUS_LOCAL, "1");
    } catch {
      // stockage indisponible — tant pis, l'invite réapparaîtra, pas grave
    }
  }, []);

  const inviteDejaRejetee = useCallback((): boolean => {
    try {
      return window.localStorage.getItem(CLE_REFUS_LOCAL) === "1";
    } catch {
      return false;
    }
  }, []);

  return { etat, activer, desactiver, rejeterInvite, inviteDejaRejetee };
}
