"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
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
  const { t } = useLocale();
  const [data, setData] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>("/admin/finance/dashboard")
      .then(setData)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, []);

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_finance")} ELEGANZ</h1>
      <p style={{ marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <Link href="/admin/finance/regles-fiscales">{t("admfinance_lienReglesFiscales")} →</Link>
        <Link href="/admin/finance/comptabilite">{t("admfinance_lienComptabilite")} →</Link>
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("admfinance_calculEnCours")}</p>
      ) : !data ? (
        <p>{t("admfinance_aucuneDonnee")}</p>
      ) : (
        <>
          <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
            {t("admfinance_moisEnCours")} — {data.statut}
          </p>

          <div className={styles.grille}>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>{t("admfinance_valeurTotaleTransactionsVendeurs")}</div>
              <div className={styles.carteValeur}>{f(data.valeurTotaleTransactionsVendeurs)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>{t("admfinance_revenusFactures")}</div>
              <div className={styles.carteValeur}>{f(data.revenusElegans.factures)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>{t("admfinance_revenusEncaisses")}</div>
              <div className={styles.carteValeur}>{f(data.revenusElegans.encaisses)} $</div>
            </div>
            <div className={styles.carte}>
              <div className={styles.carteLabel}>{t("admfinance_commissionMarketplace")}</div>
              <div className={styles.carteValeur}>{f(data.commissionMarketplace.montant)} $</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)", marginTop: "4px" }}>
                {data.commissionMarketplace.statut}
              </div>
            </div>
          </div>

          <h2 className={styles.sectionTitre}>{t("admfinance_revenusParSource")}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>{t("admfinance_colonneSource")}</th>
                <th style={{ textAlign: "right" }}>{t("admfinance_colonneFacture")}</th>
                <th style={{ textAlign: "right" }}>{t("admfinance_colonneEncaisse")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("admfinance_sourceAbonnementsBoutique")}</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsBoutique.facture)} $</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.abonnementsBoutique.encaisse)} $</td>
              </tr>
              <tr>
                <td>{t("admfinance_sourceFraisLivreur")}</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.fraisLivreur.facture)} $</td>
                <td style={{ textAlign: "right" }}>{f(data.parSource.fraisLivreur.encaisse)} $</td>
              </tr>
              <tr>
                <td>{t("admfinance_sourceAbonnementsSecourable")}</td>
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
