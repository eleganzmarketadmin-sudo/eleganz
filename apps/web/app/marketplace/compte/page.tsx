"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, ApiError } from "../../lib/auth";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

export default function ComptePage() {
  return (
    <Suspense fallback={null}>
      <ComptePageContenu />
    </Suspense>
  );
}

function ComptePageContenu() {
  const { login, register } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [onglet, setOnglet] = useState<"connexion" | "inscription">("connexion");
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function destination(): string {
    return searchParams.get("retour") ?? "/marketplace";
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      if (onglet === "connexion") {
        await login(identifiant, motDePasse);
      } else {
        if (motDePasse.length < 8) {
          setErreur(t("compte_motDePasseCourt"));
          setEnCours(false);
          return;
        }
        await register({ fullName, identifiant, motDePasse, role: "BUYER" });
      }
      router.push(destination());
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("compte_operationImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.onglets}>
        <button
          className={`${styles.onglet} ${onglet === "connexion" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("connexion")}
        >
          {t("compte_seConnecter")}
        </button>
        <button
          className={`${styles.onglet} ${onglet === "inscription" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("inscription")}
        >
          {t("compte_creerCompte")}
        </button>
      </div>

      <form onSubmit={soumettre}>
        {erreur && <div className={styles.erreur}>{erreur}</div>}

        {onglet === "inscription" && (
          <div className={styles.champ}>
            <label htmlFor="fullName">{t("compte_nomComplet")}</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        )}
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
          <label htmlFor="motDePasse">{t("compte_motDePasse")}</label>
          <input
            id="motDePasse"
            type="password"
            minLength={onglet === "inscription" ? 8 : undefined}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours
            ? t("compte_unInstant")
            : onglet === "connexion"
              ? t("compte_seConnecter")
              : t("compte_creerMonCompte")}
        </button>
        {onglet === "connexion" && (
          <p style={{ marginTop: "12px", fontSize: "0.875rem" }}>
            <Link href="/mot-de-passe-oublie">{t("compte_motDePasseOublie")}</Link>
          </p>
        )}
      </form>
    </div>
  );
}
