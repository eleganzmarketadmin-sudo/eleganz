"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ComptableShell } from "./ComptableShell";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/money";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Activite {
  id: string;
  name: string;
  category: string;
}

interface Periode {
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

interface Dashboard {
  activites: number;
  jour: Periode;
  semaine: Periode;
  mois: Periode;
  annee: Periode;
  dettesRestantes: Record<string, number>;
  creancesRestantes: Record<string, number>;
  nombreDettesEnCours: number;
  nombreCreancesEnCours: number;
}

interface Rappel {
  label: string;
  detail: string;
  refType?: string;
  refId?: string;
}

interface Reminders {
  urgents: Rappel[];
  aVenir: Rappel[];
  infos: Rappel[];
}

interface Subscription {
  billingStatus: "FREE_PERIOD" | "PAYMENT_DUE" | "ACTIVE" | "SUSPENDED";
  freeTrialStartedAt: string;
  plan: string | null;
}

function LigneSolde({ label, parDevise }: { label: string; parDevise: Record<string, number> }) {
  const entrees = Object.entries(parDevise);
  if (entrees.length === 0) return null;
  return (
    <div className={styles.carteChiffre}>
      <div className={styles.carteChiffreLabel}>{label}</div>
      {entrees.map(([devise, montant]) => (
        <div className={styles.carteChiffreValeur} key={devise}>
          {formatMoney(montant, devise)}
        </div>
      ))}
    </div>
  );
}

function RappelLigne({ rappel, niveau }: { rappel: Rappel; niveau: "urgent" | "aVenir" | "info" }) {
  const classe =
    niveau === "urgent" ? styles.rappelUrgent : niveau === "aVenir" ? styles.rappelAVenir : styles.rappelInfo;
  return (
    <div className={`${styles.rappel} ${classe}`}>
      <div>
        <div className={styles.rappelLabel}>{rappel.label}</div>
        {rappel.detail && <div className={styles.rappelDetail}>{rappel.detail}</div>}
      </div>
    </div>
  );
}

function AccueilContenu() {
  const { t } = useLocale();
  const [activites, setActivites] = useState<Activite[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Activite[]>("/comptable/activities"),
      api.get<Dashboard>("/comptable/dashboard"),
      api.get<Reminders>("/comptable/reminders"),
      api.get<Subscription>("/comptable/subscription"),
    ])
      .then(([a, d, r, s]) => {
        setActivites(a);
        setDashboard(d);
        setReminders(r);
        setSubscription(s);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;

  const joursGratuitRestants = subscription
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.freeTrialStartedAt).getTime() +
            6 * 30 * 24 * 60 * 60 * 1000 -
            Date.now()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : 0;

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_accueil")}</h1>
      <p className={styles.sousTitre}>{t("soustitre_accueil")}</p>

      {subscription && (
        <div
          className={`${styles.bandeAbonnement} ${
            subscription.billingStatus === "SUSPENDED" || subscription.billingStatus === "PAYMENT_DUE"
              ? styles.bandeAbonnementUrgente
              : ""
          }`}
        >
          <span>
            {subscription.billingStatus === "FREE_PERIOD" &&
              t("accueil_periodeGratuiteRestante").replace("{{jours}}", String(joursGratuitRestants))}
            {subscription.billingStatus === "PAYMENT_DUE" && t("accueil_periodeGratuiteEcoulee")}
            {subscription.billingStatus === "ACTIVE" && t("accueil_abonnementAJour")}
            {subscription.billingStatus === "SUSPENDED" && t("accueil_abonnementSuspendu")}
          </span>
          <Link href="/comptable/abonnement">{t("accueil_gererAbonnement")}</Link>
        </div>
      )}

      {activites.length === 0 ? (
        <div className={styles.decouvrir}>
          <p>{t("accueil_creerPremiere")}</p>
          <p style={{ marginTop: "12px" }}>
            <Link className={styles.boutonPrincipal} href="/comptable/activites">
              {t("bouton_creerActivite")}
            </Link>
          </p>
        </div>
      ) : (
        <>
          {reminders && (reminders.urgents.length > 0 || reminders.aVenir.length > 0 || reminders.infos.length > 0) && (
            <>
              {reminders.urgents.length > 0 && (
                <div className={styles.blocUrgent}>
                  <h2 className={styles.sectionTitreUrgent}>{t("accueil_urgent")}</h2>
                  {reminders.urgents.map((r, i) => (
                    <RappelLigne key={`u-${i}`} rappel={r} niveau="urgent" />
                  ))}
                </div>
              )}
              {reminders.aVenir.length > 0 && (
                <>
                  <h2 className={styles.sectionTitre}>{t("accueil_aVenir")}</h2>
                  {reminders.aVenir.map((r, i) => (
                    <RappelLigne key={`v-${i}`} rappel={r} niveau="aVenir" />
                  ))}
                </>
              )}
              {reminders.infos.length > 0 && (
                <>
                  <h2 className={styles.sectionTitre}>{t("accueil_infosUtiles")}</h2>
                  {reminders.infos.map((r, i) => (
                    <RappelLigne key={`i-${i}`} rappel={r} niveau="info" />
                  ))}
                </>
              )}
            </>
          )}

          {dashboard && (
            <>
              <h2 className={styles.sectionTitre}>{t("accueil_aujourdhui")}</h2>
              <div className={styles.grilleChiffres}>
                <div className={styles.carteChiffre}>
                  <div className={styles.carteChiffreLabel}>{t("accueil_ventesJour")}</div>
                  <div className={styles.carteChiffreValeur}>{formatMoney(dashboard.jour.ventesCdf, "CDF")}</div>
                  <div className={styles.carteChiffreSecondaire}>{formatMoney(dashboard.jour.ventesUsd, "USD")}</div>
                </div>
                <div className={styles.carteChiffre}>
                  <div className={styles.carteChiffreLabel}>{t("accueil_depensesJour")}</div>
                  <div className={styles.carteChiffreValeur}>{formatMoney(dashboard.jour.depensesCdf, "CDF")}</div>
                  <div className={styles.carteChiffreSecondaire}>{formatMoney(dashboard.jour.depensesUsd, "USD")}</div>
                </div>
                <LigneSolde label={`${t("accueil_dettesEnCours")} (${dashboard.nombreDettesEnCours})`} parDevise={dashboard.dettesRestantes} />
                <LigneSolde label={`${t("accueil_creancesEnCours")} (${dashboard.nombreCreancesEnCours})`} parDevise={dashboard.creancesRestantes} />
              </div>
              <p>
                <Link href="/comptable/chiffres">{t("accueil_voirChiffres")}</Link>
              </p>
              <Link className={styles.carteDossier} href="/comptable/dossier-financement">
                <span aria-hidden="true">💰</span> {t("titre_dossierFinancement")}
              </Link>
            </>
          )}

          <h2 className={styles.sectionTitre}>{t("accueil_mesActivites")}</h2>
          <div className={styles.activites}>
            {activites.map((a) => (
              <Link key={a.id} className={styles.activiteLien} href={`/comptable/activites/${a.id}`}>
                {a.name}
              </Link>
            ))}
            <Link className={styles.activiteLien} href="/comptable/activites">
              {t("accueil_nouvelleActivite")}
            </Link>
          </div>
        </>
      )}

      <div className={styles.decouvrir}>
        <strong>{t("accueil_decouvrirTitre")}</strong>
        <p style={{ marginTop: "8px" }}>
          {t("accueil_suiviProduits")}{" "}
          <Link href="/inscription">{t("accueil_decouvrirGestion")}</Link>.
        </p>
      </div>
    </div>
  );
}

export default function ComptableAccueilPage() {
  return (
    <ComptableShell>
      <AccueilContenu />
    </ComptableShell>
  );
}
