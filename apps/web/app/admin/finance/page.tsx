"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

// Finance & Comptabilité ELEGANZ (prompt du 13 oct. 2026, §13) — sépare
// strictement la valeur des transactions des vendeurs (A) des revenus
// réellement attribuables à ELEGANZ (B), conformément à l'exemple des
// 100 $ / 10 $ de commission (§13.3). Voir docs/ARCHITECTURE_FINANCE.md §5.
interface RepartitionFacturation {
  facture: number;
  encaisse: number;
}

interface Dashboard {
  periode: { from: string; to: string };
  valeurTotaleTransactionsVendeurs: number;
  revenusElegans: { factures: number; encaisses: number };
  parSource: {
    abonnementsBoutique: RepartitionFacturation;
    fraisLivreur: RepartitionFacturation;
    abonnementsComptable: RepartitionFacturation;
  };
  commissionMarketplace: { montant: number; statut: string };
  statut: string;
}

function f(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function FinanceAdminContenu() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>("/admin/finance/dashboard")
      .then(setData)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité ELEGANZ</h1>
      <p style={{ marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <Link href="/admin/finance/regles-fiscales">Règles fiscales applicables à ELEGANZ →</Link>
        <Link href="/admin/finance/comptabilite">Comptabilité (journal, balance) →</Link>
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Calcul en cours…</p>
      ) : !data ? (
        <p>Aucune donnée.</p>
      ) : (
        <>
          <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
            Mois en cours — {data.statut}
          </p>

          <div className={styles.grille}>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>
                Valeur totale des transactions vendeurs (A) — pas un revenu ELEGANZ
              </div>
              <div className={styles.carteValeur}>{f(data.valeurTotaleTransactionsVendeurs)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>Revenus ELEGANZ facturés (B)</div>
              <div className={styles.carteValeur}>{f(data.revenusElegans.factures)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>Revenus ELEGANZ encaissés (B)</div>
              <div className={styles.carteValeur}>{f(data.revenusElegans.encaisses)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>Commission Marketplace</div>
              <div className={styles.carteValeur}>{f(data.commissionMarketplace.montant)} $</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)", marginTop: "4px" }}>
                {data.commissionMarketplace.statut}
              </div>
            </div>
          </div>

          <h2 className={styles.sectionTitre}>Revenus par source (facturé / encaissé)</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Source</th>
                <th style={{ textAlign: "right" }}>Facturé</th>
                <th style={{ textAlign: "right" }}>Encaissé</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Abonnements boutique / Gestion</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsBoutique.facture)} $</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsBoutique.encaisse)} $</td>
              </tr>
              <tr>
                <td>Frais livreur</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.fraisLivreur.facture)} $</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.fraisLivreur.encaisse)} $</td>
              </tr>
              <tr>
                <td>Abonnements Mon Comptable</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsComptable.facture)} $</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsComptable.encaisse)} $</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default function AdminFinancePage() {
  return (
    <AdminShell>
      <FinanceAdminContenu />
    </AdminShell>
  );
}
