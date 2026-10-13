"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../AdminShell";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Miroir ELEGANZ du moteur comptable (13 oct. 2026, Phase 2) — scope
// PLATFORM uniquement, voir docs/ARCHITECTURE_FINANCE.md §8bis.5/§6. Ces
// routes ne prennent jamais de :shopId et ne touchent jamais les écritures
// d'une boutique.
interface LigneEcriture {
  id: string;
  account: { code: string; label: string };
  debit: string;
  credit: string;
}

interface Ecriture {
  id: string;
  entryDate: string;
  label: string;
  journal: { code: string };
  lines: LigneEcriture[];
}

interface LigneBalance {
  code: string;
  label: string;
  debit: number;
  credit: number;
  solde: number;
}

interface Balance {
  comptes: LigneBalance[];
  totalDebit: number;
  totalCredit: number;
  equilibree: boolean;
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

function ComptabiliteAdminContenu() {
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [journal, setJournal] = useState<Ecriture[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    const params = `from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`;
    Promise.all([
      api.get<Ecriture[]>(`/admin/finance/journal?${params}`),
      api.get<Balance>(`/admin/finance/balance?${params}`),
    ])
      .then(([j, b]) => {
        setJournal(j);
        setBalance(b);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [from, to]);

  return (
    <div>
      <h1 className={styles.titre}>Comptabilité ELEGANZ</h1>
      <p style={{ marginBottom: "16px" }}>
        <Link href="/admin/finance">← Tableau de bord Finance ELEGANZ</Link>
      </p>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
        Journal et balance générés automatiquement à partir des revenus
        ELEGANZ réellement encaissés (abonnements, frais livreur, Mon
        Comptable) — jamais à la facturation. Indépendant des écritures de
        chaque boutique. Voir docs/ARCHITECTURE_FINANCE.md §8bis.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <label>
          Du <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
        <label>
          Au <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Chargement…</p>
      ) : (
        <>
          <h2 className={styles.sectionTitre}>Journal général</h2>
          {!journal || journal.length === 0 ? (
            <p>Aucune écriture sur cette période.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "left" }}>Libellé</th>
                  <th style={{ textAlign: "left" }}>Compte</th>
                  <th style={{ textAlign: "right" }}>Débit</th>
                  <th style={{ textAlign: "right" }}>Crédit</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((e) =>
                  e.lines.map((l, i) => (
                    <tr key={l.id}>
                      {i === 0 ? (
                        <>
                          <td rowSpan={e.lines.length}>{new Date(e.entryDate).toLocaleDateString("fr-FR")}</td>
                          <td rowSpan={e.lines.length}>{e.label}</td>
                        </>
                      ) : null}
                      <td>
                        {l.account.code} — {l.account.label}
                      </td>
                      <td style={{ textAlign: "right" }}>{Number(l.debit) > 0 ? `${f(l.debit)} $` : ""}</td>
                      <td style={{ textAlign: "right" }}>{Number(l.credit) > 0 ? `${f(l.credit)} $` : ""}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}

          <h2 className={styles.sectionTitre}>Balance</h2>
          {!balance || balance.comptes.length === 0 ? (
            <p>Aucun mouvement sur cette période.</p>
          ) : (
            <>
              {!balance.equilibree && (
                <div className={styles.erreur}>
                  Anomalie : le total débit ne correspond pas au total
                  crédit — à signaler, ne pas ignorer.
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Compte</th>
                    <th style={{ textAlign: "right" }}>Débit</th>
                    <th style={{ textAlign: "right" }}>Crédit</th>
                    <th style={{ textAlign: "right" }}>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.comptes.map((c) => (
                    <tr key={c.code}>
                      <td>
                        {c.code} — {c.label}
                      </td>
                      <td style={{ textAlign: "right" }}>{f(c.debit)} $</td>
                      <td style={{ textAlign: "right" }}>{f(c.credit)} $</td>
                      <td style={{ textAlign: "right" }}>{f(c.solde)} $</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td style={{ textAlign: "right" }}>{f(balance.totalDebit)} $</td>
                    <td style={{ textAlign: "right" }}>{f(balance.totalCredit)} $</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ComptabiliteAdminPage() {
  return (
    <AdminShell>
      <ComptabiliteAdminContenu />
    </AdminShell>
  );
}
