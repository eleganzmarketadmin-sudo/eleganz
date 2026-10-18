"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { ChampMotDePasse } from "../../components/ChampMotDePasse";
import styles from "./page.module.css";

export default function InscriptionPage() {
  const { register } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse.length < 8) {
      setErreur(t("compte_motDePasseCourt"));
      return;
    }
    setEnCours(true);
    try {
      await register({ fullName, identifiant, motDePasse });
      router.push("/boutique/nouvelle");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("ginscription_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>{t("ginscription_titreMarque")}</h1>
        <p>{t("ginscription_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>{t("compte_creerCompte")}</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="fullName">{t("compte_nomComplet")}</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("compte_emailOuTelephone")}</label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">{t("ginscription_labelMotDePasse")}</label>
            <ChampMotDePasse
              id="motDePasse"
              autoComplete="new-password"
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? t("ginscription_enCours") : t("compte_creerMonCompte")}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            {t("ginscription_dejaCompte")} <Link href="/connexion">{t("compte_seConnecter")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
