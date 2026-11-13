"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { ChampMotDePasse } from "../../components/ChampMotDePasse";
import { BoutonAccueilPlateforme } from "../../components/BoutonAccueilPlateforme";
import styles from "./page.module.css";

/**
 * Connexion dédiée à "Mon assistant"/Secourable (signalement du 11 nov.
 * 2026) — jusqu'ici Secourable réutilisait silencieusement le jeton déjà
 * présent pour Gestion/Marketplace (même clé de stockage), si bien qu'un
 * compte déjà connecté ailleurs entrait directement, sans la moindre
 * reconnexion, même quand il s'agissait en réalité d'un second compte
 * distinct. Secourable reste ouvert à tout compte ELEGANZ (aucun rôle
 * imposé, voir AuthService.login) — seule la connexion en elle-même
 * redevient obligatoire, comme pour /admin et /livreur.
 */
export default function ConnexionComptablePage() {
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
      await login(identifiant, motDePasse, "comptable");
      router.push("/comptable");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cconnexion_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <BoutonAccueilPlateforme />
        <h1>{t("cconnexion_titreMarque")}</h1>
        <p>{t("cconnexion_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        {/* suppressHydrationWarning sur le <form> (13 nov. 2026, voir
            ChampMotDePasse.tsx) — une extension (gestionnaire de mots de
            passe) peut ajouter des attributs directement sur <form> avant
            l'hydratation. */}
        <form className={styles.form} onSubmit={soumettre} suppressHydrationWarning>
          <h2 style={{ marginBottom: "24px" }}>{t("cconnexion_titre")}</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("compte_emailOuTelephone")}</label>
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
            {enCours ? t("cconnexion_enCours") : t("compte_seConnecter")}
          </button>
        </form>
      </div>
    </div>
  );
}
