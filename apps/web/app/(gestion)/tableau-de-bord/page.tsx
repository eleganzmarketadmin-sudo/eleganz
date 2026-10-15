"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
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

interface EcartStock {
  id: string;
  label: string;
  quantity: number;
  sale: { id: string; createdAt: string };
  variant?: { sku: string } | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function DashboardContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [date, setDate] = useState(todayIso());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecartsStock, setEcartsStock] = useState<EcartStock[]>([]);

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
              ? t("tdb_reserveRole")
              : err instanceof Error
                ? err.message
                : t("cmd_erreurGenerique"),
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

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<EcartStock[]>(`/shops/${currentShop.id}/pos/stock-discrepancies`)
      .then(setEcartsStock)
      .catch(() => setEcartsStock([]));
  }, [currentShop]);

  return (
    <div>
      <h1 className={styles.titre}>{t("tdb_titre")}</h1>
      <p className={styles.selecteurDate}>
        {t("tdb_journeeDu")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </p>

      {chargement && <p>{t("commun_chargement")}</p>}
      {erreur && <p>{erreur}</p>}

      {dashboard && (
        <>
          {dashboard.note && <div className={styles.note}>{dashboard.note}</div>}

          <div className={styles.grille}>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>{t("tdb_ventes")}</span>
              <span className={styles.carteValeur}>{dashboard.salesCount}</span>
            </div>
            <div className={`${styles.carte} ${styles.carteEncre}`}>
              <span className={styles.carteLabel}>{t("tdb_chiffreAffaires")}</span>
              <span className={styles.carteValeur}>{formatMoney(dashboard.revenue)}</span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>{t("tdb_encaissementsConfirmes")}</span>
              <span className={styles.carteValeur}>
                {formatMoney(dashboard.confirmedCollections)}
              </span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>
                {t("tdb_margeBrute")}
                {!dashboard.marginReliable && ` ${t("tdb_margeIncomplete")}`}
              </span>
              <span className={styles.carteValeur}>
                {dashboard.grossMargin != null ? formatMoney(dashboard.grossMargin) : "—"}
              </span>
            </div>
          </div>

          <p style={{ color: "#555", fontSize: "0.875rem" }}>{t("tdb_noteMarge")}</p>
        </>
      )}

      {ecartsStock.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "12px" }}>
            {t("tdb_ecartsStockTitre")} ({ecartsStock.length})
          </h2>
          <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "12px" }}>
            {t("tdb_ecartsStockNote")}
          </p>
          <div className={styles.note}>
            {ecartsStock.map((e) => (
              <div key={e.id} style={{ marginBottom: "4px" }}>
                {e.label} ({e.variant?.sku ?? t("tdb_sansReference")}) × {e.quantity} —{" "}
                {new Date(e.sale.createdAt).toLocaleString("fr-FR")}
              </div>
            ))}
          </div>
        </div>
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
