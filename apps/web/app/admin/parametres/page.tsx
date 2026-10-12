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
}

const CHAMPS: { cle: keyof PlatformSettings; label: string; placeholder: string }[] = [
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
