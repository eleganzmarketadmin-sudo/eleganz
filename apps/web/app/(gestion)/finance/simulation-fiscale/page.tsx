"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Simulation fiscale (13 oct. 2026, Finance & Comptabilité Phase 7) — voir
// docs/ARCHITECTURE_FINANCE.md §8septies. À partir des règles fiscales
// réellement configurées et des données comptables réelles de la période —
// jamais une déclaration officielle, toujours un ordre de grandeur.
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

function SimulationFiscaleContenu() {
  const { currentShop } = useShop();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<Simulation>(
        `/shops/${currentShop.id}/finance/simulation-fiscale?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`,
      )
      .then(setSimulation)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop, from, to]);

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Estimation calculée à partir de vos règles fiscales configurées
        (onglet Règles fiscales) et de vos données comptables réelles de la
        période. Ce n&apos;est <strong>jamais une déclaration officielle</strong> :
        à vérifier avec un professionnel avant tout paiement.
      </p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label>Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label>Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Chargement…</p>
      ) : !simulation ? (
        <p>Aucune donnée.</p>
      ) : (
        <>
          <p>
            Chiffre d&apos;affaires de la période : {f(simulation.chiffreAffaires)} $ — Résultat net :{" "}
            {f(simulation.resultatNet)} $
          </p>

          {simulation.lignes.length === 0 ? (
            <p>Aucune règle fiscale simulable sur cette période.</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Règle</th>
                  <th>Base</th>
                  <th style={{ textAlign: "right" }}>Montant base</th>
                  <th style={{ textAlign: "right" }}>Taux</th>
                  <th style={{ textAlign: "right" }}>Estimation</th>
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
                  <td colSpan={4}>Total estimé</td>
                  <td style={{ textAlign: "right" }}>{f(simulation.totalEstime)} $</td>
                </tr>
              </tfoot>
            </table>
          )}

          {simulation.nonSimulables.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3>Règles non simulables automatiquement</h3>
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

export default function SimulationFiscalePage() {
  return (
    <ProtectedGestionPage>
      <SimulationFiscaleContenu />
    </ProtectedGestionPage>
  );
}
