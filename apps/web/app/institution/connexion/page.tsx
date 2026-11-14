"use client";

import { useState } from "react";
import Link from "next/link";
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
 * Revirement du 14 nov. 2026 (même jour) sur la décision initiale "pas
 * d'inscription libre" : une institution peut désormais créer elle-même son
 * compte (voir /institution/inscription), mais reste sans accès réel
 * (statut PENDING) tant qu'un admin ELEGANZ ne l'a pas explicitement
 * approuvée — voir exigerInstitutionActive côté API et le bandeau d'état
 * affiché par InstitutionShell. "Mot de passe oublié" renvoie vers l'écran
 * commun à tous les espaces (voir mot-de-passe-oublie/page.tsx), sans rien
 * de spécifique à ajouter ici.
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
          <p style={{ marginTop: "12px", fontSize: "0.875rem" }}>
            <Link href="/mot-de-passe-oublie">{t("compte_motDePasseOublie")}</Link>
          </p>
          <p style={{ marginTop: "8px", fontSize: "0.875rem" }}>
            {t("lconnexion_pasDeCompte")} <Link href="/institution/inscription">{t("inst_creerCompte")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
