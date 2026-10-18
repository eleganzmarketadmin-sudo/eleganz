"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Simulation fiscale d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct.
// 2026, point 2) — pendant plateforme de (gestion)/finance/simulation-fiscale,
// scope PLATFORM (GET /admin/finance/simulation-fiscale). Même avertissement :
// jamais une déclaration officielle, toujours un ordre de grandeur à partir
// des règles fiscales PLATFORM réellement configurées.
interface LigneSimulation {
  ruleId: string;
  label: string;
  category: string;
  rateOrFormula: string;
  base: string;
  montantBase: number;
  taux: number;
  montantEstime: number;
}

interface RegleNonSimulable {
  ruleId: string;
  label: string;
  rateOrFormula: string;
  motif: string;
}

interface Simulation {
  periode: { from: string; to: string };
  chiffreAffaires: number;
  resultatNet: number;
  lignes: LigneSimulation[];
  nonSimulables: RegleNonSimulable[];
  totalEstime: number;
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

function SimulationFiscalePlateformeContenu() {
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<Simulation>(`/admin/finance/simulation-fiscale?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`)
      .then(setSimulation)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [from, to, t]);

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titre")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("sim_noteAide1")} <strong>{t("sim_noteAideGras")}</strong> {t("sim_noteAide2")}
      </p>

      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_du")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_au")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !simulation ? (
        <p>{t("fin_aucuneDonnee")}</p>
      ) : (
        <>
          <p>
            {t("sim_chiffreAffairesPeriode")} {f(simulation.chiffreAffaires)} $ — {t("sim_resultatNet")}{" "}
            {f(simulation.resultatNet)} $
          </p>

          {simulation.lignes.length === 0 ? (
            <p>{t("sim_aucuneRegle")}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{t("sim_colRegle")}</th>
                  <th style={{ textAlign: "left" }}>{t("sim_colBase")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colMontantBase")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colTaux")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colEstimation")}</th>
                </tr>
              </thead>
              <tbody>
                {simulation.lignes.map((l) => (
                  <tr key={l.ruleId}>
                    <td>{l.label}</td>
                    <td>{l.base}</td>
                    <td style={{ textAlign: "right" }}>{f(l.montantBase)} $</td>
                    <td style={{ textAlign: "right" }}>{l.taux} %</td>
                    <td style={{ textAlign: "right" }}>{f(l.montantEstime)} $</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>{t("sim_totalEstime")}</td>
                  <td style={{ textAlign: "right" }}>{f(simulation.totalEstime)} $</td>
                </tr>
              </tfoot>
            </table>
          )}

          {simulation.nonSimulables.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3>{t("sim_reglesNonSimulables")}</h3>
              <ul>
                {simulation.nonSimulables.map((r) => (
                  <li key={r.ruleId}>
                    <strong>{r.label}</strong> ({r.rateOrFormula}) — {r.motif}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminSimulationFiscalePage() {
  return (
    <AdminShell>
      <SimulationFiscalePlateformeContenu />
    </AdminShell>
  );
}
