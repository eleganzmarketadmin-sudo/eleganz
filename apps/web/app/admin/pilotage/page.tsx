"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { EvolutionChart } from "../EvolutionChart";
import { CompteurAnime } from "../CompteurAnime";
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

interface Evolution {
  jours: string[];
  nouvellesBoutiques: number[];
  nouveauxProduits: number[];
  commandes: number[];
  valeurCommandes: number[];
  revenuPlateforme: number[];
}

function PilotageContent() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Dashboard>("/admin/cockpit/executive-dashboard"),
      api.get<Evolution>("/admin/cockpit/evolution?days=30"),
    ])
      .then(([d, e]) => {
        setDashboard(d);
        setEvolution(e);
      })
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
          <div className={`${styles.carte} ${styles.carteCobalt}`}>
            <span className={styles.carteLabel}>Boutiques</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Actives</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.activeShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>En période gratuite</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.freeShops} /></span>
          </div>
          <div className={`${styles.carte} ${dashboard.activity.suspendedShops > 0 ? styles.carteFlamme : ""}`}>
            <span className={styles.carteLabel}>Suspendues</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.suspendedShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Vendeurs</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalVendors} /></span>
          </div>
          <div className={`${styles.carte} ${styles.carteMagenta}`}>
            <span className={styles.carteLabel}>Articles au catalogue</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalProducts} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Articles épuisés</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.productsOutOfStock} /></span>
          </div>
        </div>
      </div>

      {evolution && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitre}>Évolution (30 derniers jours)</h2>
          <div className={styles.grilleGraphiques}>
            <EvolutionChart
              titre="Nouvelles boutiques"
              jours={evolution.jours}
              valeurs={evolution.nouvellesBoutiques}
              couleur="var(--color-cobalt)"
              style="barres"
            />
            <EvolutionChart
              titre="Nouveaux articles publiés"
              jours={evolution.jours}
              valeurs={evolution.nouveauxProduits}
              couleur="var(--color-magenta)"
              style="barres"
            />
            <EvolutionChart
              titre="Commandes Marketplace"
              jours={evolution.jours}
              valeurs={evolution.commandes}
              couleur="var(--color-flamme)"
              style="barres"
            />
            <EvolutionChart
              titre="Valeur brute des commandes"
              jours={evolution.jours}
              valeurs={evolution.valeurCommandes}
              couleur="var(--color-or)"
              formater={(n) => formatMoney(n)}
            />
          </div>
        </div>
      )}

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
                <span className={styles.carteValeur}><CompteurAnime valeur={n} /></span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Revenus</h2>
        <p className={styles.noteRevenu}>
          La valeur brute des commandes n&apos;est pas un revenu ELEGANZ — l&apos;essentiel revient
          aux boutiques. Seules les factures payées comptent comme revenu de la plateforme.
        </p>
        <div className={styles.grille}>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>Valeur brute des commandes</span>
            <span className={styles.carteValeur}>{formatMoney(dashboard.revenue.grossOrderValue)}</span>
          </div>
          <div className={`${styles.carte} ${styles.carteOr}`}>
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

      {evolution && (
        <div className={styles.section}>
          <EvolutionChart
            titre="Revenu plateforme encaissé"
            jours={evolution.jours}
            valeurs={evolution.revenuPlateforme}
            couleur="var(--color-vert-paiement)"
            formater={(n) => formatMoney(n)}
          />
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Litiges</h2>
        <div className={styles.grille}>
          <div className={`${styles.carte} ${dashboard.operations.openDisputes > 0 ? styles.carteFlamme : ""}`}>
            <span className={styles.carteLabel}>Litiges ouverts</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.operations.openDisputes} /></span>
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
