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

const LABELS_STATUT: Record<string, string> = {
  FREE_PERIOD: "Période gratuite en cours",
  PAYMENT_DUE: "Paiement attendu",
  ACTIVE: "Abonnement à jour",
  SUSPENDED: "Suspendu pour impayé",
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
      .then(([s, t]) => {
        setSubscription(s);
        setTarification(t);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
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
      setErreur(err instanceof ApiError ? err.message : "Choix impossible pour le moment.");
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
          <span>Statut</span>
          <strong>{LABELS_STATUT[subscription.billingStatus]}</strong>
        </div>
        <div className={styles.ligne}>
          <span>Début de la période gratuite</span>
          <span>{formatDate(subscription.freeTrialStartedAt)}</span>
        </div>
        <div className={styles.ligne}>
          <span>Durée de gratuité</span>
          <span>{tarification.comptableFreeMonths} mois</span>
        </div>
        {subscription.renewsAt && (
          <div className={styles.ligne}>
            <span>Prochain renouvellement</span>
            <span>{formatDate(subscription.renewsAt)}</span>
          </div>
        )}
        <div className={styles.ligne}>
          <span>Formule choisie</span>
          <span>{subscription.plan === "YEARLY" ? "Annuelle" : subscription.plan === "MONTHLY" ? "Mensuelle" : "Non choisie"}</span>
        </div>
      </div>

      <h2 style={{ marginBottom: "16px" }}>Choisir une formule après la période gratuite</h2>
      <div className={styles.plans}>
        <div className={`${styles.plan} ${subscription.plan === "MONTHLY" ? styles.planChoisi : ""}`}>
          <div>Mensuelle</div>
          <div className={styles.planPrix}>{tarification.comptableMonthlyFee} $ / mois</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("MONTHLY")}>
            {subscription.plan === "MONTHLY" ? "Formule actuelle" : "Choisir"}
          </button>
        </div>
        <div className={`${styles.plan} ${subscription.plan === "YEARLY" ? styles.planChoisi : ""}`}>
          <div>Annuelle</div>
          <div className={styles.planPrix}>{tarification.comptableYearlyFee} $ / an</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("YEARLY")}>
            {subscription.plan === "YEARLY" ? "Formule actuelle" : "Choisir"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: "24px", color: "var(--color-texte-muted)", fontSize: "0.875rem" }}>
        Vos données restent consultables et exportables même après l&apos;expiration de la période gratuite.
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
