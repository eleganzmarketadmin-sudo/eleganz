"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Clôture de période d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct.
// 2026, point 5 : "Pages admin manquantes alors que l'API existe déjà") —
// pendant plateforme de (gestion)/finance/cloture. Les routes API
// (GET/POST /admin/finance/clotures, DELETE /admin/finance/clotures/:periode,
// scope PLATFORM) existaient déjà, mais aucune page ne les appelait : la
// comptabilité plateforme ne pouvait être clôturée/rouverte qu'en base.
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

function CloturePlateformeContenu() {
  const { t } = useLocale();
  const [clotures, setClotures] = useState<Cloture[] | null>(null);
  const [periode, setPeriode] = useState(moisCourant());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const recharger = () => {
    setChargement(true);
    api
      .get<Cloture[]>("/admin/finance/clotures")
      .then(setClotures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  };

  useEffect(recharger, []);

  const cloturer = async () => {
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post("/admin/finance/clotures", { periode });
      setConfirmation(t("clo_periodeCloturee").replace("{{periode}}", periode));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    }
  };

  const reouvrir = async (periodeCloture: string) => {
    setErreur(null);
    setConfirmation(null);
    try {
      await api.delete(`/admin/finance/clotures/${periodeCloture}`);
      setConfirmation(t("clo_periodeRouverte").replace("{{periode}}", periodeCloture));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    }
  };

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titreCloture")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("clo_noteAide")}
      </p>

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "24px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("clo_moisACloturer")}</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <button type="button" className={styles.bouton} onClick={cloturer}>
          {t("clo_cloturerCeMois")}
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.message}>{confirmation}</div>}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !clotures || clotures.length === 0 ? (
        <p>{t("clo_aucunePeriode")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("ana_colMois")}</th>
              <th style={{ textAlign: "left" }}>{t("clo_colClotureLe")}</th>
              <th style={{ textAlign: "right" }}>{t("clo_colTotalDebit")}</th>
              <th style={{ textAlign: "right" }}>{t("clo_colTotalCredit")}</th>
              <th style={{ textAlign: "right" }}>{t("ana_colResultatNet")}</th>
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
                    <button
                      type="button"
                      onClick={() => reouvrir(p)}
                      style={{ border: "1px solid var(--color-flamme)", background: "var(--color-surface)", color: "var(--color-flamme)", padding: "4px 10px", minHeight: 32, cursor: "pointer", fontSize: "0.8125rem" }}
                    >
                      {t("clo_rouvrir")}
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

export default function AdminCloturePage() {
  return (
    <AdminShell>
      <CloturePlateformeContenu />
    </AdminShell>
  );
}
