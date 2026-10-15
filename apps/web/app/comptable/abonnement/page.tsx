"use client";

import { useEffect, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Subscription {
  billingStatus: "FREE_PERIOD" | "PAYMENT_DUE" | "ACTIVE" | "SUSPENDED";
  freeTrialStartedAt: string;
  activatedAt: string;
  plan: "MONTHLY" | "YEARLY" | null;
  renewsAt: string | null;
}

interface Tarification {
  comptableMonthlyFee: string;
  comptableYearlyFee: string;
  comptableFreeMonths: number;
}

const CLES_STATUT: Record<string, string> = {
  FREE_PERIOD: "abo_statutPeriodeGratuite",
  PAYMENT_DUE: "abo_statutPaiementAttendu",
  ACTIVE: "abo_statutAJour",
  SUSPENDED: "abo_statutSuspendu",
};

function AbonnementContenu() {
  const { t } = useLocale();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tarification, setTarification] = useState<Tarification | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function recharger() {
    Promise.all([
      api.get<Subscription>("/comptable/subscription"),
      api.get<Tarification>("/platform-settings/comptable-pricing", false),
    ])
      .then(([s, tp]) => {
        setSubscription(s);
        setTarification(tp);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function choisir(plan: "MONTHLY" | "YEARLY") {
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/subscription/plan", { plan });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("abo_choixImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (!subscription || !tarification) return <p className={styles.erreur}>{erreur}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_abonnement")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.carte}>
        <div className={styles.ligne}>
          <span>{t("abo_statut")}</span>
          <strong>{t(CLES_STATUT[subscription.billingStatus])}</strong>
        </div>
        <div className={styles.ligne}>
          <span>{t("abo_debutPeriodeGratuite")}</span>
          <span>{formatDate(subscription.freeTrialStartedAt)}</span>
        </div>
        <div className={styles.ligne}>
          <span>{t("abo_dureeGratuite")}</span>
          <span>{tarification.comptableFreeMonths} {t("imm_mois")}</span>
        </div>
        {subscription.renewsAt && (
          <div className={styles.ligne}>
            <span>{t("abo_prochainRenouvellement")}</span>
            <span>{formatDate(subscription.renewsAt)}</span>
          </div>
        )}
        <div className={styles.ligne}>
          <span>{t("abo_formuleChoisie")}</span>
          <span>{subscription.plan === "YEARLY" ? t("abo_annuelle") : subscription.plan === "MONTHLY" ? t("abo_mensuelle") : t("abo_nonChoisie")}</span>
        </div>
      </div>

      <h2 style={{ marginBottom: "16px" }}>{t("abo_choisirFormule")}</h2>
      <div className={styles.plans}>
        <div className={`${styles.plan} ${subscription.plan === "MONTHLY" ? styles.planChoisi : ""}`}>
          <div>{t("abo_mensuelle")}</div>
          <div className={styles.planPrix}>{tarification.comptableMonthlyFee} $ / {t("abo_mois")}</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("MONTHLY")}>
            {subscription.plan === "MONTHLY" ? t("abo_formuleActuelle") : t("abo_choisir")}
          </button>
        </div>
        <div className={`${styles.plan} ${subscription.plan === "YEARLY" ? styles.planChoisi : ""}`}>
          <div>{t("abo_annuelle")}</div>
          <div className={styles.planPrix}>{tarification.comptableYearlyFee} $ / {t("abo_an")}</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("YEARLY")}>
            {subscription.plan === "YEARLY" ? t("abo_formuleActuelle") : t("abo_choisir")}
          </button>
        </div>
      </div>

      <p style={{ marginTop: "24px", color: "var(--color-texte-muted)", fontSize: "0.875rem" }}>
        {t("abo_noteDonneesConsultables")}
      </p>
    </div>
  );
}

export default function ComptableAbonnementPage() {
  return (
    <ComptableShell>
      <AbonnementContenu />
    </ComptableShell>
  );
}
