"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Trésorerie d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct. 2026,
// point 5 : "Pages admin manquantes alors que l'API existe déjà") — pendant
// plateforme de (gestion)/finance/tresorerie. La route API
// (GET /admin/finance/tresorerie, scope PLATFORM) existait déjà, mais aucune
// page ne l'appelait. Contrairement au côté boutique, cette page n'inclut
// pas la gestion des comptes bancaires/mobile money multiples : la
// plateforme ne dispose aujourd'hui que des comptes de caisse 5711/5712
// (USD/CDF) — l'équivalent plateforme de la gestion multi-comptes et des
// immobilisations est un chantier séparé (audit du 18 oct. 2026, point 6).
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

function TresoreriePlateformeContenu() {
  const { t } = useLocale();
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
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<ReleveTresorerie>(`/admin/finance/tresorerie?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`)
      .then(setReleve)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [from, to, t]);

  const soldeUsd = releve?.comptes.find((c) => c.code === "5711")?.soldeFinal ?? 0;
  const soldeCdf = releve?.comptes.find((c) => c.code === "5712")?.soldeFinal ?? 0;
  const equivalentUsd = taux?.cdfPerUsd ? soldeUsd + soldeCdf / taux.cdfPerUsd : null;

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titreTresorerie")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("tre_noteAide")}
      </p>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_du")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_au")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !releve || releve.comptes.length === 0 ? (
        <p>{t("tre_aucuneCaisse")}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
            {releve.comptes.map((c) => (
              <div key={c.code} style={{ border: "2px solid var(--color-ink)", padding: "16px", minWidth: "220px" }}>
                <div style={{ fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: "1.5rem" }}>{f(c.soldeFinal)}</div>
                <div style={{ color: "var(--color-texte-muted)", fontSize: "0.8rem" }}>{t("tre_soldeOuverture")} {f(c.soldeInitial)}</div>
              </div>
            ))}
            <div style={{ border: "2px solid var(--color-ink)", padding: "16px", minWidth: "220px" }}>
              <div style={{ fontWeight: 700 }}>{t("tre_equivalentTotal")}</div>
              <div style={{ fontSize: "1.5rem" }}>{equivalentUsd === null ? "—" : `${f(equivalentUsd)} $`}</div>
              <div style={{ color: "var(--color-texte-muted)", fontSize: "0.8rem" }}>
                {taux?.cdfPerUsd
                  ? `${t("tre_tauxDuJour")} 1 $ = ${f(taux.cdfPerUsd)} CDF`
                  : t("tre_tauxNonConfigure")}
              </div>
            </div>
          </div>

          {releve.comptes.map((c) => (
            <div key={c.code} style={{ marginBottom: "24px" }}>
              <h3>
                {c.label} — {t("tre_mouvementsDeLaPeriode")}
              </h3>
              {c.mouvements.length === 0 ? (
                <p>{t("tre_aucunMouvement")}</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
                      <th style={{ textAlign: "left" }}>{t("tre_colLibelle")}</th>
                      <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
                      <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
                      <th style={{ textAlign: "right" }}>{t("tre_colSoldeCumule")}</th>
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

export default function AdminTresoreriePage() {
  return (
    <AdminShell>
      <TresoreriePlateformeContenu />
    </AdminShell>
  );
}
