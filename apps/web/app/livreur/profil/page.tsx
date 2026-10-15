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

  useEffect(() => {
    api
      .get<DriverProfile>("/delivery/me")
      .then(setProfil)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

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
          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("livr_contact")}</span>
            <span>{profil.user.email ?? profil.user.phone}</span>
          </div>
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
