"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

export default function ConnexionLivreurPage() {
  const { login } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await login(identifiant, motDePasse);
      router.push("/livreur/missions");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("lconnexion_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>{t("lconnexion_titreMarque")}</h1>
        <p>{t("lconnexion_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>{t("lconnexion_titre")}</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
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
            <label htmlFor="motDePasse">{t("compte_motDePasse")}</label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? t("lconnexion_enCours") : t("compte_seConnecter")}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            {t("lconnexion_pasDeCompte")} <Link href="/livreur/inscription">{t("lconnexion_devenirLivreur")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
