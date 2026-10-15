"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface PlatformSettings {
  address?: string | null;
  website?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  whatsappLink?: string | null;
  telegramLink?: string | null;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  photoSearchEnabled?: boolean;
  adStudioEnabled?: boolean;
  notificationsInAppEnabled?: boolean;
  notificationsEmailEnabled?: boolean;
  notificationsSmsEnabled?: boolean;
}

const FONCTIONNALITES_IA: { cle: "photoSearchEnabled" | "adStudioEnabled"; label: string; description: string }[] = [
  {
    cle: "photoSearchEnabled",
    label: "Recherche par photo (Marketplace)",
    description:
      "Un acheteur prend un vêtement en photo et retrouve des articles similaires. Nécessite un fournisseur d'embeddings d'image (Google Vision, Replicate…) — pas encore branché.",
  },
  {
    cle: "adStudioEnabled",
    label: "Studio publicitaire IA (Gestion)",
    description:
      "Génère des visuels/vidéos publicitaires pour un produit. Nécessite un générateur d'image/vidéo (DALL·E, Stability, Replicate…) — pas encore branché.",
  },
];

type ChampTexte = Exclude<
  keyof PlatformSettings,
  | "photoSearchEnabled"
  | "adStudioEnabled"
  | "notificationsInAppEnabled"
  | "notificationsEmailEnabled"
  | "notificationsSmsEnabled"
>;

const CANAUX_NOTIFICATION: {
  cle: "notificationsInAppEnabled" | "notificationsEmailEnabled" | "notificationsSmsEnabled";
  label: string;
  description: string;
}[] = [
  {
    cle: "notificationsInAppEnabled",
    label: "Notifications dans la plateforme",
    description:
      "Cloche 🔔 et centre de messagerie pour tous les acteurs (vendeurs, comptables, livreurs, acheteurs) : nouvelle commande, nouveau message, échéances. Activé par défaut.",
  },
  {
    cle: "notificationsEmailEnabled",
    label: "Notifications par e-mail",
    description:
      "Prévu mais sans effet tant qu'aucun fournisseur d'envoi d'e-mails n'est branché (ex. SendGrid, Mailgun) — l'activer ici ne fait rien de plus aujourd'hui, par choix explicite plutôt que d'écrire une notification qui ne serait jamais envoyée.",
  },
  {
    cle: "notificationsSmsEnabled",
    label: "Notifications par SMS",
    description:
      "Même principe que l'e-mail : prévu, pas encore branché à un fournisseur SMS. Voir aussi les crédits SMS/WhatsApp premium (section services à la carte).",
  },
];

const CHAMPS: { cle: ChampTexte; label: string; placeholder: string }[] = [
  { cle: "address", label: "Adresse", placeholder: "Ex. 12 Avenue du Commerce, Gombe, Kinshasa" },
  { cle: "website", label: "Site web", placeholder: "https://eleganz-production.up.railway.app" },
  { cle: "supportEmail", label: "Email clientèle", placeholder: "support@eleganz.cd" },
  { cle: "supportPhone", label: "Numéro de contact", placeholder: "+243 81 234 5678" },
  { cle: "whatsappLink", label: "Lien WhatsApp", placeholder: "https://wa.me/243812345678" },
  { cle: "telegramLink", label: "Lien Telegram", placeholder: "https://t.me/eleganz" },
  { cle: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@eleganz" },
  { cle: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/eleganz" },
];

function ParametresContent() {
  const [valeurs, setValeurs] = useState<PlatformSettings>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    api
      .get<PlatformSettings>("/admin/platform-settings")
      .then(setValeurs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", valeurs);
      setValeurs(resultat);
      setConfirmation(
        "Coordonnées enregistrées — elles apparaîtront sur la signature de tous les documents imprimés.",
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) return <p>Chargement…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Paramètres plateforme</h1>
      <p className={styles.sousTitre}>
        Ces coordonnées officielles d&apos;ELEGANZ apparaissent dans la signature de bas de page de
        tous les documents imprimés (tickets, factures, bons de livraison) de toutes les boutiques.
      </p>

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {confirmation && <p className={styles.confirmation}>{confirmation}</p>}

      <form className={styles.formulaire} onSubmit={enregistrer}>
        {CHAMPS.map((champ) => (
          <div className={styles.champ} key={champ.cle}>
            <label htmlFor={champ.cle}>{champ.label}</label>
            <input
              id={champ.cle}
              value={valeurs[champ.cle] ?? ""}
              onChange={(e) => setValeurs((v) => ({ ...v, [champ.cle]: e.target.value }))}
              placeholder={champ.placeholder}
            />
          </div>
        ))}
        <button className={styles.boutonEnregistrer} type="submit" disabled={enregistrement}>
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <h2 className={styles.titreSection}>Notifications</h2>
      <p className={styles.sousTitre}>
        Choisissez quels canaux de notification sont actifs sur la plateforme. Ce réglage s&apos;applique
        immédiatement à tous les comptes (vendeurs, comptables, livreurs, acheteurs, équipe admin).
      </p>
      <div className={styles.listeBascules}>
        {CANAUX_NOTIFICATION.map((canal) => (
          <label className={styles.bascule} key={canal.cle}>
            <input
              type="checkbox"
              checked={Boolean(valeurs[canal.cle])}
              onChange={async (e) => {
                const coche = e.target.checked;
                setValeurs((v) => ({ ...v, [canal.cle]: coche }));
                try {
                  const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
                    [canal.cle]: coche,
                  });
                  setValeurs(resultat);
                } catch (err) {
                  setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
                }
              }}
            />
            <div>
              <div className={styles.basculeLabel}>{canal.label}</div>
              <div className={styles.basculeDescription}>{canal.description}</div>
            </div>
          </label>
        ))}
      </div>

      <h2 className={styles.titreSection}>Fonctionnalités IA prévues</h2>
      <p className={styles.sousTitre}>
        Ces fonctionnalités existent déjà comme points d&apos;entrée dans les écrans (visibles mais
        désactivés, « Bientôt disponible »). Les activer ici ne les rend pas fonctionnelles tant
        qu&apos;un fournisseur n&apos;est pas choisi et payé — c&apos;est une préparation pour le jour où
        vous déciderez d&apos;investir dedans, en fonction des recettes et de la croissance.
      </p>
      <div className={styles.listeBascules}>
        {FONCTIONNALITES_IA.map((f) => (
          <label className={styles.bascule} key={f.cle}>
            <input
              type="checkbox"
              checked={Boolean(valeurs[f.cle])}
              onChange={async (e) => {
                const coche = e.target.checked;
                setValeurs((v) => ({ ...v, [f.cle]: coche }));
                try {
                  const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
                    [f.cle]: coche,
                  });
                  setValeurs(resultat);
                } catch (err) {
                  setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
                }
              }}
            />
            <div>
              <div className={styles.basculeLabel}>{f.label}</div>
              <div className={styles.basculeDescription}>{f.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AdminParametresPage() {
  return (
    <AdminShell>
      <ParametresContent />
    </AdminShell>
  );
}
