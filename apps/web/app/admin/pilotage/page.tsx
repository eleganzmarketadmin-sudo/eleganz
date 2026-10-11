"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

interface Dashboard {
  activity: {
    totalShops: number;
    shopsByStatus: Record<string, number>;
    activeShops: number;
    freeShops: number;
    suspendedShops: number;
    totalVendors: number;
    totalProducts: number;
    productsOutOfStock: number;
    ordersByStatus: Record<string, number>;
  };
  revenue: {
    grossOrderValue: number;
    platformRevenueByKind: Record<string, number>;
    pendingInvoicesAmount: number;
  };
  operations: { openDisputes: number };
  aiUsage: { note?: string };
}

function PilotageContent() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api
      .get<Dashboard>("/admin/cockpit/executive-dashboard")
      .then(setDashboard)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p>Chargement du tableau de bord…</p>;
  if (erreur) return <p>{erreur}</p>;
  if (!dashboard) return null;

  const revenuPlatformeTotal = Object.values(dashboard.revenue.platformRevenueByKind).reduce(
    (s, v) => s + v,
    0,
  );

  return (
    <div>
      <h1 className={styles.titre}>Tableau de bord exécutif</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Activité</h2>
        <div className={styles.grille}>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Boutiques</span>
            <span className={styles.carteValeur}>{dashboard.activity.totalShops}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Actives</span>
            <span className={styles.carteValeur}>{dashboard.activity.activeShops}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>En période gratuite</span>
            <span className={styles.carteValeur}>{dashboard.activity.freeShops}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Suspendues</span>
            <span className={styles.carteValeur}>{dashboard.activity.suspendedShops}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Vendeurs</span>
            <span className={styles.carteValeur}>{dashboard.activity.totalVendors}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Articles au catalogue</span>
            <span className={styles.carteValeur}>{dashboard.activity.totalProducts}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Articles épuisés</span>
            <span className={styles.carteValeur}>{dashboard.activity.productsOutOfStock}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Commandes Marketplace par statut</h2>
        <div className={styles.grille}>
          {Object.entries(dashboard.activity.ordersByStatus).length === 0 ? (
            <div className={styles.carte}>
              <span className={styles.carteLabel}>Aucune commande encore</span>
            </div>
          ) : (
            Object.entries(dashboard.activity.ordersByStatus).map(([statut, n]) => (
              <div className={styles.carte} key={statut}>
                <span className={styles.carteLabel}>{statut}</span>
                <span className={styles.carteValeur}>{n}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Revenus</h2>
        <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "12px" }}>
          La valeur brute des commandes n&apos;est pas un revenu ELEGANZ — l&apos;essentiel revient
          aux boutiques. Seules les factures payées comptent comme revenu de la plateforme.
        </p>
        <div className={styles.grille}>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Valeur brute des commandes</span>
            <span className={styles.carteValeur}>{formatMoney(dashboard.revenue.grossOrderValue)}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Revenu ELEGANZ (factures payées)</span>
            <span className={styles.carteValeur}>{formatMoney(revenuPlatformeTotal)}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Factures en attente</span>
            <span className={styles.carteValeur}>
              {formatMoney(dashboard.revenue.pendingInvoicesAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Litiges</h2>
        <div className={styles.grille}>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Litiges ouverts</span>
            <span className={styles.carteValeur}>{dashboard.operations.openDisputes}</span>
          </div>
        </div>
      </div>

      {dashboard.aiUsage.note && <div className={styles.note}>{dashboard.aiUsage.note}</div>}
    </div>
  );
}

export default function PilotagePage() {
  return (
    <AdminShell>
      <PilotageContent />
    </AdminShell>
  );
}
