"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface DriverProfile {
  zone: string | null;
  verified: boolean;
  billingStatus: string;
  freeTrialStartedAt: string | null;
  user: { fullName: string; email: string | null; phone: string | null };
}

const CLES_FACTURATION: Record<string, string> = {
  FREE_PERIOD: "abo_statutPeriodeGratuite",
  PAYMENT_DUE: "abo_statutPaiementAttendu",
  ACTIVE: "abo_statutAJour",
  SUSPENDED: "livr_statutSuspendu",
};

function ProfilContent() {
  const { t } = useLocale();
  const [profil, setProfil] = useState<DriverProfile | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Édition du téléphone/email personnel (demande du 16 oct. 2026, point 2)
  // — distincte des informations de livraison ci-dessous, qui restent gérées
  // par /delivery/me.
  const [editionCompte, setEditionCompte] = useState(false);
  const [emailEdite, setEmailEdite] = useState("");
  const [telephoneEdite, setTelephoneEdite] = useState("");
  const [enregistrementCompte, setEnregistrementCompte] = useState(false);
  const [erreurCompte, setErreurCompte] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DriverProfile>("/delivery/me")
      .then(setProfil)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  function ouvrirEditionCompte() {
    setEmailEdite(profil?.user.email ?? "");
    setTelephoneEdite(profil?.user.phone ?? "");
    setErreurCompte(null);
    setEditionCompte(true);
  }

  async function enregistrerCompte(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrementCompte(true);
    setErreurCompte(null);
    try {
      const miseAJour = await api.patch<{ fullName: string; email: string | null; phone: string | null }>(
        "/auth/me",
        {
          email: emailEdite.trim() || undefined,
          phone: telephoneEdite.trim() || undefined,
        },
      );
      setProfil((p) => (p ? { ...p, user: { ...p.user, email: miseAJour.email, phone: miseAJour.phone } } : p));
      setEditionCompte(false);
    } catch (err) {
      setErreurCompte(err instanceof ApiError ? err.message : t("profil_erreurEnregistrement"));
    } finally {
      setEnregistrementCompte(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("livr_monProfilLivreur")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {profil && (
        <div className={styles.fiche}>
          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("activites_nom")}</span>
            <span>{profil.user.fullName}</span>
          </div>

          {editionCompte ? (
            <form onSubmit={enregistrerCompte}>
              <label className={styles.champFormulaire}>
                <span className={styles.champLabel}>{t("profil_email")}</span>
                <input type="email" value={emailEdite} onChange={(e) => setEmailEdite(e.target.value)} />
              </label>
              <label className={styles.champFormulaire}>
                <span className={styles.champLabel}>{t("profil_telephone")}</span>
                <input value={telephoneEdite} onChange={(e) => setTelephoneEdite(e.target.value)} placeholder={t("profil_placeholderTelephone")} />
              </label>
              {erreurCompte && <p className={styles.erreur}>{erreurCompte}</p>}
              <div style={{ display: "flex", gap: "var(--espace-2)", marginTop: "var(--espace-3)" }}>
                <button className={styles.bouton} type="submit" disabled={enregistrementCompte}>
                  {enregistrementCompte ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
                </button>
                <button className={styles.boutonSecondaire} type="button" onClick={() => setEditionCompte(false)}>
                  {t("action_annuler")}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.champ}>
                <span className={styles.champLabel}>{t("profil_email")}</span>
                <span>{profil.user.email ?? t("profil_nonRenseigne")}</span>
              </div>
              <div className={styles.champ}>
                <span className={styles.champLabel}>{t("profil_telephone")}</span>
                <span>{profil.user.phone ?? t("profil_nonRenseigne")}</span>
              </div>
              <div style={{ marginTop: "var(--espace-2)" }}>
                <button className={styles.boutonSecondaire} onClick={ouvrirEditionCompte}>
                  {t("profil_modifier")}
                </button>
              </div>
            </>
          )}

          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("livr_zone")}</span>
            <span>{profil.zone ?? t("livr_zoneNonPrecisee")}</span>
          </div>
          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("livr_verification")}</span>
            <span className={profil.verified ? styles.statutVerifie : styles.statutNonVerifie}>
              {profil.verified
                ? t("livr_verifiePeutRecevoirMissions")
                : t("livr_enAttenteVerification")}
            </span>
          </div>
          {profil.verified && (
            <div className={styles.champ}>
              <span className={styles.champLabel}>{t("abo_statut")}</span>
              <span className={profil.billingStatus === "SUSPENDED" ? styles.statutNonVerifie : styles.statutVerifie}>
                {CLES_FACTURATION[profil.billingStatus] ? t(CLES_FACTURATION[profil.billingStatus]) : profil.billingStatus}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilLivreurPage() {
  return (
    <LivreurShell>
      <ProfilContent />
    </LivreurShell>
  );
}
