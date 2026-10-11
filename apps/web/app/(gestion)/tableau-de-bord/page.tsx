"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

interface Dashboard {
  date: string;
  salesCount: number;
  revenue: number;
  confirmedCollections: number;
  grossMargin: number | null;
  marginReliable: boolean;
  note?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function DashboardContent() {
  const { currentShop } = useShop();
  const [date, setDate] = useState(todayIso());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    api
      .get<Dashboard>(`/shops/${currentShop.id}/pos/dashboard/daily?date=${date}`)
      .then((data) => {
        if (!annule) setDashboard(data);
      })
      .catch((err) => {
        if (!annule) {
          setErreur(
            err instanceof ApiError && err.statusCode === 403
              ? "Ce tableau de bord est réservé au propriétaire, au gérant ou au comptable de la boutique."
              : err instanceof Error
                ? err.message
                : "Erreur.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop, date]);

  return (
    <div>
      <h1 className={styles.titre}>Tableau de bord du jour</h1>
      <p className={styles.selecteurDate}>
        Journée du
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </p>

      {chargement && <p>Chargement…</p>}
      {erreur && <p>{erreur}</p>}

      {dashboard && (
        <>
          {dashboard.note && <div className={styles.note}>{dashboard.note}</div>}

          <div className={styles.grille}>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>Ventes</span>
              <span className={styles.carteValeur}>{dashboard.salesCount}</span>
            </div>
            <div className={`${styles.carte} ${styles.carteEncre}`}>
              <span className={styles.carteLabel}>Chiffre d&apos;affaires</span>
              <span className={styles.carteValeur}>{formatMoney(dashboard.revenue)}</span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>Encaissements confirmés</span>
              <span className={styles.carteValeur}>
                {formatMoney(dashboard.confirmedCollections)}
              </span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>
                Marge brute{!dashboard.marginReliable && " (incomplète)"}
              </span>
              <span className={styles.carteValeur}>
                {dashboard.grossMargin != null ? formatMoney(dashboard.grossMargin) : "—"}
              </span>
            </div>
          </div>

          <p style={{ color: "#555", fontSize: "0.875rem" }}>
            Le chiffre d&apos;affaires compte toutes les ventes de la journée, même celles pas
            encore totalement encaissées (crédit client). La marge brute n&apos;est fiable que si
            le prix d&apos;achat est renseigné sur chaque article vendu.
          </p>
        </>
      )}
    </div>
  );
}

export default function TableauDeBordPage() {
  return (
    <ProtectedGestionPage>
      <DashboardContent />
    </ProtectedGestionPage>
  );
}
