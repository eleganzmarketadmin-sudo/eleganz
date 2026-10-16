"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface ReponseDemande {
  canal: "EMAIL" | "WHATSAPP" | "ADMIN";
  destinataireMasque?: string;
  message: string;
}

// Mot de passe oublié (16 oct. 2026, point 1, puis "je veux que la
// réception d'un code par email/WhatsApp soit branché") : page commune à
// tous les espaces (Marketplace, Gestion, Livreur, Centre de pilotage).
// Une seule étape suffit à décider le canal (le serveur choisit — email
// d'abord, puis WhatsApp, voir PasswordResetService) : si un code a pu
// être envoyé, l'étape 2 permet de le saisir avec le nouveau mot de passe
// sans aucune intervention admin ; sinon, la demande est honnêtement
// transmise à l'administration (même écran de confirmation qu'avant).
export default function MotDePasseOubliePage() {
  const { t } = useLocale();
  const [identifiant, setIdentifiant] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<ReponseDemande | null>(null);

  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [reinitialise, setReinitialise] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await api.post<ReponseDemande>(
        "/mot-de-passe-oublie",
        { identifiant, message: message || undefined },
        false,
      );
      setReponse(resultat);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("mdpoublie_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setVerificationEnCours(true);
    try {
      await api.post("/mot-de-passe-oublie/verifier", { identifiant, code, newPassword: nouveauMotDePasse }, false);
      setReinitialise(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("mdpoublie_codeInvalide"));
    } finally {
      setVerificationEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("mdpoublie_titre")}</h1>
      <p className={styles.sousTitre}>{t("mdpoublie_sousTitre")}</p>

      {reinitialise ? (
        <div className={styles.confirmation}>{t("mdpoublie_motDePasseReinitialise")}</div>
      ) : !reponse ? (
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
            {enCours ? t("mdpoublie_envoiEnCours") : t("mdpoublie_envoyer")}
          </button>
        </form>
      ) : reponse.canal === "ADMIN" ? (
        <div className={styles.confirmation}>{reponse.message}</div>
      ) : (
        <form onSubmit={verifierCode}>
          <p className={styles.optionsIndisponibles}>
            {t(reponse.canal === "EMAIL" ? "mdpoublie_codeEnvoyeEmail" : "mdpoublie_codeEnvoyeWhatsapp").replace(
              "{destinataire}",
              reponse.destinataireMasque ?? "",
            )}
          </p>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="code">{t("mdpoublie_labelCode")}</label>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="nouveauMotDePasse">{t("mdpoublie_labelNouveauMotDePasse")}</label>
            <input
              id="nouveauMotDePasse"
              type="password"
              minLength={8}
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={verificationEnCours || code.length !== 6}>
            {verificationEnCours ? t("mdpoublie_verificationEnCours") : t("mdpoublie_reinitialiserMotDePasse")}
          </button>
        </form>
      )}

      {(reinitialise || reponse?.canal === "ADMIN") && (
        <p style={{ marginTop: "24px", fontSize: "0.875rem" }}>
          <Link href="/">{t("mdpoublie_retourAccueil")}</Link>
        </p>
      )}
    </div>
  );
}
