"use client";

import { useEffect, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Compte {
  fullName: string;
  email: string | null;
  phone: string | null;
}

// Page "Mon compte" d'ELEGANZ Mon assistant (demande du 16 oct. 2026, point
// 2) — jusqu'ici cet espace n'avait aucune page d'identité personnelle,
// contrairement à Marketplace et Livreur. Même endpoint /auth/me que les
// autres espaces : le compte ELEGANZ est commun à tous.
function ProfilContent() {
  const { t } = useLocale();
  const [compte, setCompte] = useState<Compte | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [edition, setEdition] = useState(false);
  const [nomEdite, setNomEdite] = useState("");
  const [emailEdite, setEmailEdite] = useState("");
  const [telephoneEdite, setTelephoneEdite] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    api
      .get<Compte>("/auth/me")
      .then(setCompte)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  function ouvrirEdition() {
    setNomEdite(compte?.fullName ?? "");
    setEmailEdite(compte?.email ?? "");
    setTelephoneEdite(compte?.phone ?? "");
    setErreur(null);
    setEdition(true);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    try {
      const miseAJour = await api.patch<Compte>("/auth/me", {
        fullName: nomEdite.trim() || undefined,
        email: emailEdite.trim() || undefined,
        phone: telephoneEdite.trim() || undefined,
      });
      setCompte(miseAJour);
      setEdition(false);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("profil_erreurEnregistrement"));
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("profil_informationsCompte")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.carte}>
        {edition ? (
          <form className={styles.formulaire} onSubmit={enregistrer}>
            <div className={styles.champ}>
              <label>{t("activites_nom")}</label>
              <input value={nomEdite} onChange={(e) => setNomEdite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_email")}</label>
              <input type="email" value={emailEdite} onChange={(e) => setEmailEdite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_telephone")}</label>
              <input
                value={telephoneEdite}
                onChange={(e) => setTelephoneEdite(e.target.value)}
                placeholder={t("profil_placeholderTelephone")}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--espace-3)" }}>
              <button className={styles.bouton} type="submit" disabled={enregistrement}>
                {enregistrement ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
              </button>
              <button className={styles.boutonSecondaire} type="button" onClick={() => setEdition(false)}>
                {t("action_annuler")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.ligne}>
              <span>{t("activites_nom")}</span>
              <span>{compte?.fullName ?? "…"}</span>
            </div>
            <div className={styles.ligne}>
              <span>{t("profil_email")}</span>
              <span>{compte?.email ?? t("profil_nonRenseigne")}</span>
            </div>
            <div className={styles.ligne}>
              <span>{t("profil_telephone")}</span>
              <span>{compte?.phone ?? t("profil_nonRenseigne")}</span>
            </div>
            <div style={{ marginTop: "var(--espace-3)" }}>
              <button className={styles.boutonSecondaire} onClick={ouvrirEdition}>
                {t("profil_modifier")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilComptablePage() {
  return (
    <ComptableShell>
      <ProfilContent />
    </ComptableShell>
  );
}
