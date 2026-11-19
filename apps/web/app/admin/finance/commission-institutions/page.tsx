"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { telechargerFichier } from "../../../lib/telecharger-fichier";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Rapport détaillé "Commission Institutions" — voir ventes-caisse/page.tsx
// pour le contexte de la demande (même gabarit, autre source).
// Source des lignes : AdminFinanceService.listerCommissionInstitutions /
// exporterCommissionInstitutions (GET /admin/finance/commission-institutions,
// même agrégat que la carte "institutions" du pilotage —
// Loan.institutionCommissionAmount, figée au décaissement, filtrée ici sur
// Loan.dateObtention — mais filtrable par période, ce que la carte ne
// permet pas).
interface LigneCommissionInstitution {
  id: string;
  institution: string;
  boutique: string;
  pret: string;
  montantPret: number;
  commission: number;
  devise: string;
  date: string;
}

interface CommissionInstitutionsReponse {
  periode: { from: string; to: string };
  total: number;
  lignes: LigneCommissionInstitution[];
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function debutMois(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function CommissionInstitutionsContenu() {
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [donnees, setDonnees] = useState<CommissionInstitutionsReponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<CommissionInstitutionsReponse>(
        `/admin/finance/commission-institutions?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`,
      )
      .then(setDonnees)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [from, to, t]);

  async function exporter() {
    setExportEnCours(true);
    setErreur(null);
    try {
      const toExclusif = new Date(to);
      toExclusif.setDate(toExclusif.getDate() + 1);
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", toExclusif.toISOString().slice(0, 10));
      await telechargerFichier(
        `/admin/finance/export/commission-institutions?${params.toString()}`,
        "commission-institutions-eleganz.xlsx",
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("fin_erreurGenerique"));
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admci_titre")}</h1>
      <AdminFinanceSubNav />

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_du")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_au")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <button className={styles.bouton} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? t("admci_exportEnCours") : t("admci_exporter")}
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !donnees || donnees.lignes.length === 0 ? (
        <p>{t("admci_aucune")}</p>
      ) : (
        <>
          <div
            style={{
              border: "2px solid var(--color-ink)",
              padding: "16px",
              minWidth: "220px",
              marginBottom: "20px",
              display: "inline-block",
            }}
          >
            <div style={{ fontWeight: 700 }}>{t("admci_total")}</div>
            <div style={{ fontSize: "1.5rem" }}>{f(donnees.total)}</div>
          </div>

          <div className={styles.tableauScroll}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{t("admci_colInstitution")}</th>
                  <th style={{ textAlign: "left" }}>{t("admci_colBoutique")}</th>
                  <th style={{ textAlign: "left" }}>{t("admci_colPret")}</th>
                  <th style={{ textAlign: "right" }}>{t("admci_colMontantPret")}</th>
                  <th style={{ textAlign: "right" }}>{t("admci_colCommission")}</th>
                  <th style={{ textAlign: "left" }}>{t("admci_colDevise")}</th>
                  <th style={{ textAlign: "left" }}>{t("admci_colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {donnees.lignes.map((l) => (
                  <tr key={l.id}>
                    <td>{l.institution}</td>
                    <td>{l.boutique}</td>
                    <td>{l.pret}</td>
                    <td style={{ textAlign: "right" }}>{f(l.montantPret)}</td>
                    <td style={{ textAlign: "right" }}>{f(l.commission)}</td>
                    <td>{l.devise}</td>
                    <td>{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminCommissionInstitutionsPage() {
  return (
    <AdminShell>
      <CommissionInstitutionsContenu />
    </AdminShell>
  );
}
