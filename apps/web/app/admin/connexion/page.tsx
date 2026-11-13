"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { ChampMotDePasse } from "../../components/ChampMotDePasse";
import { BoutonAccueilPlateforme } from "../../components/BoutonAccueilPlateforme";
import styles from "./page.module.css";

export default function AdminConnexionPage() {
  const { login } = useAuth();
  const { t } = useLocale();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await login(identifiant, motDePasse, "admin");
      // Navigation complète plutôt que router.push() (13 nov. 2026,
      // signalement "connexion réussie mais revient à la connexion", qui
      // persistait malgré le correctif du jeton React dans AdminShell) :
      // router.push() dépend d'une requête RSC côté client qui peut rester
      // bloquée ou échouer silencieusement (réseau lent/instable observé
      // dans les captures du signalement), laissant l'ancienne page
      // affichée sans la moindre erreur visible. Un rechargement complet
      // revient toujours au même résultat fiable : AuthProvider relit le
      // jeton (déjà en localStorage) dès le montage de la page, sans
      // dépendre du routeur client.
      window.location.href = "/admin/pilotage";
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("lconnexion_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <BoutonAccueilPlateforme />
        <h1>{t("footer_centreDePilotage")}</h1>
        <p>{t("adminconnexion_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        {/* suppressHydrationWarning sur le <form> (13 nov. 2026, voir
            ChampMotDePasse.tsx) — une extension (gestionnaire de mots de
            passe) peut ajouter des attributs directement sur <form> avant
            l'hydratation. */}
        <form className={styles.form} onSubmit={soumettre} suppressHydrationWarning>
          <h2 style={{ marginBottom: "24px" }}>{t("adminconnexion_titre")}</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("adminconnexion_email")}</label>
            <input
              id="identifiant"
              name="identifiant"
              type="text"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
              suppressHydrationWarning
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">{t("compte_motDePasse")}</label>
            <ChampMotDePasse
              id="motDePasse"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? t("lconnexion_enCours") : t("compte_seConnecter")}
          </button>
          <p style={{ marginTop: "12px", fontSize: "0.875rem" }}>
            <Link href="/mot-de-passe-oublie">{t("compte_motDePasseOublie")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
