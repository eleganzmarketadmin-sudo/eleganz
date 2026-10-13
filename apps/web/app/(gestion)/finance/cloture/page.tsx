"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Assistant de clôture de période (13 oct. 2026, Finance & Comptabilité
// Phase 5) — voir docs/ARCHITECTURE_FINANCE.md §8quinquies. Clôturer un
// mois verrouille toute nouvelle écriture comptable pour ce mois (la
// réouverture reste possible : pas un registre légalement immuable, un
// outil interne).
interface Cloture {
  id: string;
  periodDate: string;
  closedAt: string;
  totalDebit: string;
  totalCredit: string;
  resultatNet: string;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function moisAuFormat(date: string): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ClotureContenu() {
  const { currentShop } = useShop();
  const [clotures, setClotures] = useState<Cloture[] | null>(null);
  const [periode, setPeriode] = useState(moisCourant());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const recharger = () => {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Cloture[]>(`/shops/${currentShop.id}/finance/clotures`)
      .then(setClotures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  };

  useEffect(recharger, [currentShop]);

  const cloturer = async () => {
    if (!currentShop) return;
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/finance/clotures`, { periode });
      setConfirmation(`Période ${periode} clôturée.`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  const reouvrir = async (periodeCloture: string) => {
    if (!currentShop) return;
    setErreur(null);
    setConfirmation(null);
    try {
      await api.delete(`/shops/${currentShop.id}/finance/clotures/${periodeCloture}`);
      setConfirmation(`Période ${periodeCloture} rouverte.`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Clôturer un mois fige un résumé (totaux débit/crédit, résultat net)
        et verrouille ce mois : plus aucune écriture comptable (vente,
        charge, achat, dotation d&apos;amortissement…) ne sera acceptée pour
        cette période. La réouverture reste possible en cas d&apos;erreur —
        cet outil n&apos;est pas un registre légalement immuable.
      </p>

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "24px" }}>
        <div className={styles.champ}>
          <label>Mois à clôturer</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} />
        </div>
        <button type="button" className={styles.bouton} onClick={cloturer}>
          Clôturer ce mois
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      {chargement ? (
        <p>Chargement…</p>
      ) : !clotures || clotures.length === 0 ? (
        <p>Aucune période clôturée.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Mois</th>
              <th>Clôturé le</th>
              <th style={{ textAlign: "right" }}>Total débit</th>
              <th style={{ textAlign: "right" }}>Total crédit</th>
              <th style={{ textAlign: "right" }}>Résultat net</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clotures.map((c) => {
              const p = moisAuFormat(c.periodDate);
              return (
                <tr key={c.id}>
                  <td>{p}</td>
                  <td>{new Date(c.closedAt).toLocaleDateString("fr-FR")}</td>
                  <td style={{ textAlign: "right" }}>{f(c.totalDebit)} $</td>
                  <td style={{ textAlign: "right" }}>{f(c.totalCredit)} $</td>
                  <td style={{ textAlign: "right" }}>{f(c.resultatNet)} $</td>
                  <td>
                    <button type="button" className={styles.retirer} onClick={() => reouvrir(p)}>
                      Rouvrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CloturePage() {
  return (
    <ProtectedGestionPage>
      <ClotureContenu />
    </ProtectedGestionPage>
  );
}
