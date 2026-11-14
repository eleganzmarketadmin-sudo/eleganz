"use client";

import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { ChampMotDePasse } from "../../components/ChampMotDePasse";
import { BoutonAccueilPlateforme } from "../../components/BoutonAccueilPlateforme";
import styles from "./page.module.css";

/**
 * Connexion dédiée au portail institutions (14 nov. 2026 — microfinances,
 * banques, coopératives) — même cloisonnement de jeton/espace que
 * admin/livreur/comptable (voir espaceAuth()/cleJeton() dans api.ts et le
 * contrôle de rôle dans AuthService.login : `dto.espace === "institution"`
 * exige `role === "INSTITUTION_STAFF"`, jamais un rôle choisi côté front).
 * Un compte institution est créé exclusivement par un admin ELEGANZ (voir
 * AdminInstitutionsService) — pas d'inscription libre ici, volontairement.
 */
export default function ConnexionInstitutionPage() {
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
      await login(identifiant, motDePasse, "institution");
      // Navigation complète plutôt que router.push() — voir le commentaire
      // détaillé dans admin/connexion/page.tsx (13 nov. 2026).
      window.location.href = "/institution";
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("iconnexion_erreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <BoutonAccueilPlateforme />
        <h1>{t("iconnexion_titreMarque")}</h1>
        <p>{t("iconnexion_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        {/* suppressHydrationWarning sur le <form> (13 nov. 2026, voir
            ChampMotDePasse.tsx) — une extension (gestionnaire de mots de
            passe) peut ajouter des attributs directement sur <form> avant
            l'hydratation. */}
        <form className={styles.form} onSubmit={soumettre} suppressHydrationWarning>
          <h2 style={{ marginBottom: "24px" }}>{t("iconnexion_titre")}</h2>
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
            {enCours ? t("iconnexion_enCours") : t("compte_seConnecter")}
          </button>
        </form>
      </div>
    </div>
  );
}
