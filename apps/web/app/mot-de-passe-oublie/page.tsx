"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Mot de passe oublié (16 oct. 2026, point 1 — "donner la possibilité en
// cas de mot de passe oublié à l'utilisateur de réinitialiser et recevoir
// le code (par email ou sms) et l'option alternative de solliciter l'admin
// de la plateforme") : page commune à tous les espaces (Marketplace,
// Gestion, Livreur, Centre de pilotage), l'identifiant suffit à retrouver
// le compte quel qu'il soit. Seule l'option "solliciter l'admin" est
// disponible pour l'instant — recevoir un code par email/WhatsApp suppose
// de brancher un fournisseur d'envoi externe, pas encore choisi.
export default function MotDePasseOubliePage() {
  const { t } = useLocale();
  const [identifiant, setIdentifiant] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await api.post("/mot-de-passe-oublie", { identifiant, message: message || undefined }, false);
      setEnvoye(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("mdpoublie_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("mdpoublie_titre")}</h1>
      <p className={styles.sousTitre}>{t("mdpoublie_sousTitre")}</p>

      <p className={styles.optionsIndisponibles}>{t("mdpoublie_codeIndisponible")}</p>

      {envoye ? (
        <div className={styles.confirmation}>{t("mdpoublie_confirmation")}</div>
      ) : (
        <form onSubmit={soumettre}>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("compte_emailOuTelephone")}</label>
            <input
              id="identifiant"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="message">{t("mdpoublie_messagePourAdmin")}</label>
            <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? t("mdpoublie_envoiEnCours") : t("mdpoublie_solliciterAdmin")}
          </button>
        </form>
      )}

      <p style={{ marginTop: "24px", fontSize: "0.875rem" }}>
        <Link href="/">{t("mdpoublie_retourAccueil")}</Link>
      </p>
    </div>
  );
}
