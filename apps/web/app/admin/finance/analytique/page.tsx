"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Analytique et prévisions d'ELEGANZ elle-même (18 oct. 2026, audit du 18
// oct. 2026, point 5 : "Pages admin manquantes alors que l'API existe déjà")
// — pendant plateforme de (gestion)/finance/analytique. La route API
// (GET /admin/finance/analytique, scope PLATFORM) existait déjà, mais
// aucune page ne l'appelait : l'équipe ELEGANZ ne pouvait suivre sa propre
// évolution mensuelle qu'en lisant la base directement. Même calcul, même
// mise en garde sur la projection (moyenne mobile des 3 derniers mois
// complets, jamais le mois courant partiel).
interface MoisAnalytique {
  mois: string;
  chiffreAffaires: number;
  charges: number;
  resultatNet: number;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function moyenneMobile(serie: MoisAnalytique[]): number | null {
  const moisComplets = serie.slice(0, -1);
  const fenetre = moisComplets.slice(-3);
  if (fenetre.length === 0) return null;
  return fenetre.reduce((s, m) => s + m.chiffreAffaires, 0) / fenetre.length;
}

function Barre({ valeur, max }: { valeur: number; max: number }) {
  const largeur = max > 0 ? Math.max((Math.abs(valeur) / max) * 100, valeur !== 0 ? 2 : 0) : 0;
  return (
    <div style={{ background: "var(--color-border)", height: "10px", width: "100%" }}>
      <div
        style={{
          background: valeur >= 0 ? "var(--color-vert-paiement)" : "var(--color-flamme)",
          height: "100%",
          width: `${largeur}%`,
        }}
      />
    </div>
  );
}

function AnalytiquePlateformeContenu() {
  const { t } = useLocale();
  const [serie, setSerie] = useState<MoisAnalytique[] | null>(null);
  const [nombreMois, setNombreMois] = useState(6);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    api
      .get<MoisAnalytique[]>(`/admin/finance/analytique?mois=${nombreMois}`)
      .then(setSerie)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [nombreMois, t]);

  const projection = serie ? moyenneMobile(serie) : null;
  const maxCa = serie ? Math.max(...serie.map((m) => m.chiffreAffaires), projection ?? 0, 1) : 1;

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titreAnalytique")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("ana_noteAide")}
      </p>

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("ana_nombreMois")}</label>
          <select value={nombreMois} onChange={(e) => setNombreMois(Number(e.target.value))} style={{ minHeight: 40 }}>
            <option value={3}>{t("ana_3mois")}</option>
            <option value={6}>{t("ana_6mois")}</option>
            <option value={12}>{t("ana_12mois")}</option>
          </select>
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !serie || serie.length === 0 ? (
        <p>{t("fin_aucuneDonnee")}</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>{t("ana_colMois")}</th>
                <th style={{ textAlign: "right" }}>{t("fin_chiffreAffaires")}</th>
                <th></th>
                <th style={{ textAlign: "right" }}>{t("fin_charges")}</th>
                <th style={{ textAlign: "right" }}>{t("ana_colResultatNet")}</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((m, i) => (
                <tr key={m.mois}>
                  <td>
                    {m.mois}
                    {i === serie.length - 1 ? ` (${t("ana_enCoursPartiel")})` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>{f(m.chiffreAffaires)} $</td>
                  <td style={{ width: "160px" }}>
                    <Barre valeur={m.chiffreAffaires} max={maxCa} />
                  </td>
                  <td style={{ textAlign: "right" }}>{f(m.charges)} $</td>
                  <td style={{ textAlign: "right" }}>{f(m.resultatNet)} $</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: "16px" }}>
            {projection === null
              ? t("ana_pasAssezDeMois")
              : `${t("ana_projectionLabel")} ${f(projection)} $`}
          </p>
        </>
      )}
    </div>
  );
}

export default function AdminAnalytiquePage() {
  return (
    <AdminShell>
      <AnalytiquePlateformeContenu />
    </AdminShell>
  );
}
