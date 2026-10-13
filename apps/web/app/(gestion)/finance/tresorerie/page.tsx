"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Trésorerie multidevise réelle (13 oct. 2026, Finance & Comptabilité
// Phase 9) — voir docs/ARCHITECTURE_FINANCE.md §8nonies. Les soldes réels
// par devise existaient déjà dans les comptes 5711 (Caisse USD) et 5712
// (Caisse CDF) ; cet écran ajoute le solde d'ouverture, l'historique des
// mouvements, et un équivalent indicatif en USD calculé à partir du taux de
// change public déjà existant — jamais inventé si ce taux n'est pas
// configuré.
interface Mouvement {
  date: string;
  label: string;
  sourceType: string;
  debit: number;
  credit: number;
  soldeCumule: number;
}

interface CompteCaisse {
  code: string;
  label: string;
  soldeInitial: number;
  mouvements: Mouvement[];
  soldeFinal: number;
}

interface ReleveTresorerie {
  periode: { from: string; to: string };
  comptes: CompteCaisse[];
}

interface TauxChange {
  cdfPerUsd: number | null;
  updatedAt: string | null;
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

function TresorerieContenu() {
  const { currentShop } = useShop();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [releve, setReleve] = useState<ReleveTresorerie | null>(null);
  const [taux, setTaux] = useState<TauxChange | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<TauxChange>("/platform-settings/exchange-rate", false).then(setTaux).catch(() => setTaux(null));
  }, []);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<ReleveTresorerie>(
        `/shops/${currentShop.id}/finance/tresorerie?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`,
      )
      .then(setReleve)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop, from, to]);

  const soldeUsd = releve?.comptes.find((c) => c.code === "5711")?.soldeFinal ?? 0;
  const soldeCdf = releve?.comptes.find((c) => c.code === "5712")?.soldeFinal ?? 0;
  const equivalentUsd = taux?.cdfPerUsd ? soldeUsd + soldeCdf / taux.cdfPerUsd : null;

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Soldes et mouvements réels des deux caisses (USD et CDF), déjà
        comptabilisés automatiquement par les ventes, charges et achats.
        L&apos;équivalent total en USD est indicatif, calculé au taux de
        change système du jour — jamais figé par transaction à cette phase.
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
      ) : !releve || releve.comptes.length === 0 ? (
        <p>Aucune caisse configurée pour cette boutique.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
            {releve.comptes.map((c) => (
              <div key={c.code} style={{ border: "2px solid var(--color-ink)", padding: "16px", minWidth: "220px" }}>
                <div style={{ fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: "1.5rem" }}>{f(c.soldeFinal)}</div>
                <div style={{ color: "#888", fontSize: "0.8rem" }}>Solde d&apos;ouverture : {f(c.soldeInitial)}</div>
              </div>
            ))}
            <div style={{ border: "2px solid var(--color-ink)", padding: "16px", minWidth: "220px" }}>
              <div style={{ fontWeight: 700 }}>Équivalent total (indicatif)</div>
              <div style={{ fontSize: "1.5rem" }}>{equivalentUsd === null ? "—" : `${f(equivalentUsd)} $`}</div>
              <div style={{ color: "#888", fontSize: "0.8rem" }}>
                {taux?.cdfPerUsd
                  ? `Taux du jour : 1 $ = ${f(taux.cdfPerUsd)} CDF`
                  : "Taux de change non configuré — aucun équivalent calculé."}
              </div>
            </div>
          </div>

          {releve.comptes.map((c) => (
            <div key={c.code} style={{ marginBottom: "24px" }}>
              <h3>
                {c.label} — mouvements de la période
              </h3>
              {c.mouvements.length === 0 ? (
                <p>Aucun mouvement sur cette période.</p>
              ) : (
                <table className={styles.tableau}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Libellé</th>
                      <th style={{ textAlign: "right" }}>Débit</th>
                      <th style={{ textAlign: "right" }}>Crédit</th>
                      <th style={{ textAlign: "right" }}>Solde cumulé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.mouvements.map((m, i) => (
                      <tr key={i}>
                        <td>{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                        <td>{m.label}</td>
                        <td style={{ textAlign: "right" }}>{m.debit > 0 ? f(m.debit) : ""}</td>
                        <td style={{ textAlign: "right" }}>{m.credit > 0 ? f(m.credit) : ""}</td>
                        <td style={{ textAlign: "right" }}>{f(m.soldeCumule)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function TresoreriePage() {
  return (
    <ProtectedGestionPage>
      <TresorerieContenu />
    </ProtectedGestionPage>
  );
}
