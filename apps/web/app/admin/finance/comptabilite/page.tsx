"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../AdminShell";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
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

interface LigneEtat {
  code: string;
  label: string;
  montant: number;
}

interface CompteDeResultat {
  charges: LigneEtat[];
  produits: LigneEtat[];
  totalCharges: number;
  totalProduits: number;
  resultatNet: number;
}

interface Bilan {
  actif: LigneEtat[];
  passif: LigneEtat[];
  totalActif: number;
  totalPassif: number;
  equilibre: boolean;
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
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [journal, setJournal] = useState<Ecriture[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [compteResultat, setCompteResultat] = useState<CompteDeResultat | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    const toExclusifStr = toExclusif.toISOString().slice(0, 10);
    const params = `from=${from}&to=${toExclusifStr}`;
    Promise.all([
      api.get<Ecriture[]>(`/admin/finance/journal?${params}`),
      api.get<Balance>(`/admin/finance/balance?${params}`),
      api.get<CompteDeResultat>(`/admin/finance/compte-resultat?${params}`),
      api.get<Bilan>(`/admin/finance/bilan?asOf=${toExclusifStr}`),
    ])
      .then(([j, b, cr, bi]) => {
        setJournal(j);
        setBalance(b);
        setCompteResultat(cr);
        setBilan(bi);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [from, to, t]);

  return (
    <div>
      <h1 className={styles.titre}>{t("admfinct_titre")}</h1>
      <p style={{ marginBottom: "16px" }}>
        <Link href="/admin/finance">{t("admfinct_lienTableauBord")}</Link>
      </p>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
        {t("admfinct_description")}
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <label>
          {t("rel_du")} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
        <label>
          {t("rel_au")} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : (
        <>
          <h2 className={styles.sectionTitre}>{t("cpt_journalGeneral")}</h2>
          {!journal || journal.length === 0 ? (
            <p>{t("cpt_aucuneEcriturePeriode")}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
                  <th style={{ textAlign: "left" }}>{t("tre_colLibelle")}</th>
                  <th style={{ textAlign: "left" }}>{t("cpt_compte")}</th>
                  <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
                  <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
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

          <h2 className={styles.sectionTitre}>{t("cpt_balance")}</h2>
          {!balance || balance.comptes.length === 0 ? (
            <p>{t("cpt_aucunMouvementPeriode")}</p>
          ) : (
            <>
              {!balance.equilibree && (
                <div className={styles.erreur}>
                  {t("cpt_anomalieBalance")}
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>{t("cpt_compte")}</th>
                    <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
                    <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
                    <th style={{ textAlign: "right" }}>{t("cpt_colSolde")}</th>
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
                    <td>{t("cpt_total")}</td>
                    <td style={{ textAlign: "right" }}>{f(balance.totalDebit)} $</td>
                    <td style={{ textAlign: "right" }}>{f(balance.totalCredit)} $</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <h2 className={styles.sectionTitre}>{t("cpt_compteDeResultat")}</h2>
          {!compteResultat || (compteResultat.charges.length === 0 && compteResultat.produits.length === 0) ? (
            <p>{t("cpt_aucuneChargeProduitPeriode")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
              <div>
                <h3>{t("cpt_charges")}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {compteResultat.charges.map((l) => (
                      <tr key={l.code}>
                        <td>{l.code} — {l.label}</td>
                        <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td>{t("cpt_totalCharges")}</td>
                      <td style={{ textAlign: "right" }}>{f(compteResultat.totalCharges)} $</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div>
                <h3>{t("cpt_produits")}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {compteResultat.produits.map((l) => (
                      <tr key={l.code}>
                        <td>{l.code} — {l.label}</td>
                        <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td>{t("cpt_totalProduits")}</td>
                      <td style={{ textAlign: "right" }}>{f(compteResultat.totalProduits)} $</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ gridColumn: "1 / -1", fontWeight: 700 }}>
                {t("cpt_resultatNetPeriode")} {f(compteResultat.resultatNet)} $ (
                {compteResultat.resultatNet >= 0 ? t("cpt_benefice") : t("cpt_perte")})
              </p>
            </div>
          )}

          <h2 className={styles.sectionTitre}>{t("cpt_bilan")}</h2>
          {!bilan || (bilan.actif.length === 0 && bilan.passif.length === 0) ? (
            <p>{t("cpt_aucunSoldeDate")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {!bilan.equilibre && (
                <div className={styles.erreur} style={{ gridColumn: "1 / -1" }}>
                  {t("cpt_anomalieBilan")}
                </div>
              )}
              <div>
                <h3>{t("cpt_actif")}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {bilan.actif.map((l) => (
                      <tr key={l.code}>
                        <td>{l.code} — {l.label}</td>
                        <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td>{t("cpt_totalActif")}</td>
                      <td style={{ textAlign: "right" }}>{f(bilan.totalActif)} $</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div>
                <h3>{t("cpt_passif")}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {bilan.passif.map((l) => (
                      <tr key={l.code}>
                        <td>{l.code} — {l.label}</td>
                        <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td>{t("cpt_totalPassif")}</td>
                      <td style={{ textAlign: "right" }}>{f(bilan.totalPassif)} $</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
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
