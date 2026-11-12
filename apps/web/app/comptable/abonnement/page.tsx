"use client";

import { useEffect, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Bouquet {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxActivities: number | null;
  featuresJson: Record<string, unknown>;
}

interface Subscription {
  billingStatus: "FREE_PERIOD" | "PAYMENT_DUE" | "ACTIVE" | "SUSPENDED";
  freeTrialStartedAt: string;
  activatedAt: string;
  plan: "MONTHLY" | "YEARLY" | null;
  renewsAt: string | null;
  bouquetId: string | null;
  bouquet: Bouquet | null;
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

// Les 4 fonctionnalités de bouquet Secourable (voir
// comptable-plans.service.ts) — mêmes clés de traduction que l'écran
// /admin/tarifs (section Mon assistant), réutilisées ici pour que l'abonné
// voie exactement ce que chaque bouquet inclut.
const CLES_FONCTIONNALITES_COMPTABLE: { cle: string; cleTrad: string }[] = [
  { cle: "historiqueIllimite", cleTrad: "admtarifs_cpt_historiqueIllimite" },
  { cle: "comparaisonPeriodes", cleTrad: "admtarifs_cpt_comparaisonPeriodes" },
  { cle: "rappelsAgenda", cleTrad: "admtarifs_cpt_rappelsAgenda" },
  { cle: "exportDossierFinancement", cleTrad: "admtarifs_cpt_exportDossierFinancement" },
];

function AbonnementContenu() {
  const { t } = useLocale();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tarification, setTarification] = useState<Tarification | null>(null);
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bouquetEnCours, setBouquetEnCours] = useState<string | null>(null);

  function recharger() {
    Promise.all([
      api.get<Subscription>("/comptable/subscription"),
      api.get<Tarification>("/platform-settings/comptable-pricing", false),
      api.get<Bouquet[]>("/comptable/plans", false),
    ])
      .then(([s, tp, b]) => {
        setSubscription(s);
        setTarification(tp);
        setBouquets(b);
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

  async function choisirBouquet(bouquetId: string) {
    setBouquetEnCours(bouquetId);
    setErreur(null);
    try {
      await api.post("/comptable/subscription/bouquet", { bouquetId });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("abo_choixImpossible"));
    } finally {
      setBouquetEnCours(null);
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

      <h2 style={{ marginBottom: "16px" }}>{t("abo_choisirBouquet")}</h2>
      <div className={styles.bouquets}>
        {bouquets.map((b) => {
          const actif = b.id === subscription.bouquetId;
          const fonctionnalites = CLES_FONCTIONNALITES_COMPTABLE.filter(({ cle }) => b.featuresJson[cle] === true);
          return (
            <button
              key={b.id}
              type="button"
              className={`${styles.carteBouquet} ${actif ? styles.carteBouquetActive : ""}`}
              disabled={bouquetEnCours !== null}
              onClick={() => !actif && choisirBouquet(b.id)}
            >
              <strong>{b.name}</strong>
              <p className={styles.prixBouquet}>
                {b.monthlyPrice} $ {t("abonnement_parMois")}
              </p>
              {b.maxActivities != null && (
                <p className={styles.note}>
                  {t("abo_activitesMax")} : {b.maxActivities}
                </p>
              )}
              {fonctionnalites.length > 0 && (
                <ul className={styles.listeFonctionnalites}>
                  {fonctionnalites.map(({ cleTrad }) => (
                    <li key={cleTrad}>{t(cleTrad)}</li>
                  ))}
                </ul>
              )}
              {actif && <span className={styles.badgeChoisi}>{t("abonnement_bouquetActuelBadge")}</span>}
            </button>
          );
        })}
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
