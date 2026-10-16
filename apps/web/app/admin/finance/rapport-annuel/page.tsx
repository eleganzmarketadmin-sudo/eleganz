"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
import { telechargerFichier } from "../../../lib/telecharger-fichier";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface ChiffresCles {
  chiffreAffaires: number;
  charges: number;
  resultatNet: number;
  margeNette: number | null;
  croissanceCA: number | null;
}

interface RapportAnnuelApercu {
  entiteNom: string;
  annee: number;
  chiffresCles: ChiffresCles;
}

function f(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function fPct(n: number | null): string {
  return n === null ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

// Rapport annuel d'ELEGANZ elle-même (demande du 16 oct. 2026, point 3) —
// pendant plateforme du rapport annuel boutique, mêmes formats d'export.
function RapportAnnuelPlateformeContenu() {
  const { t } = useLocale();
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const [apercu, setApercu] = useState<RapportAnnuelApercu | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    api
      .get<RapportAnnuelApercu>(`/admin/finance/rapport-annuel?annee=${annee}`)
      .then(setApercu)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [annee, t]);

  async function telecharger(format: "pdf" | "docx" | "pptx") {
    setTelechargementEnCours(format);
    setErreur(null);
    try {
      if (format === "pdf") {
        await ouvrirDocumentPdf(`/admin/finance/export/rapport-annuel?annee=${annee}&format=pdf`);
      } else {
        await telechargerFichier(
          `/admin/finance/export/rapport-annuel?annee=${annee}&format=${format}`,
          `rapport-annuel-eleganz-${annee}.${format}`,
        );
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("credit_erreurGeneration"));
    } finally {
      setTelechargementEnCours(null);
    }
  }

  const annees = Array.from({ length: 6 }, (_, i) => anneeCourante - i);

  return (
    <div>
      <h1 className={styles.titre}>{t("rapann_titreAdmin")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>{t("rapann_sousTitre")}</p>

      <div style={{ maxWidth: "200px", marginBottom: "16px" }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rapann_labelAnnee")}</label>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ padding: "10px", border: "2px solid var(--color-ink)", width: "100%" }}>
          {annees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : apercu ? (
        <div style={{ border: "2px solid var(--color-ink)", padding: "16px", marginBottom: "20px" }}>
          <h2 style={{ marginBottom: "12px" }}>{t("rapann_chiffresClesTitre")}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td>{t("rapann_chiffreAffaires")}</td>
                <td style={{ textAlign: "right" }}>{f(apercu.chiffresCles.chiffreAffaires)} $</td>
              </tr>
              <tr>
                <td>{t("rapann_charges")}</td>
                <td style={{ textAlign: "right" }}>{f(apercu.chiffresCles.charges)} $</td>
              </tr>
              <tr>
                <td>{t("rapann_resultatNet")}</td>
                <td style={{ textAlign: "right" }}>{f(apercu.chiffresCles.resultatNet)} $</td>
              </tr>
              <tr>
                <td>{t("rapann_margeNette")}</td>
                <td style={{ textAlign: "right" }}>{fPct(apercu.chiffresCles.margeNette)}</td>
              </tr>
              <tr>
                <td>{t("rapann_croissanceCA")}</td>
                <td style={{ textAlign: "right" }}>{fPct(apercu.chiffresCles.croissanceCA)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ border: "2px solid var(--color-ink)", padding: "16px" }}>
        <h2 style={{ marginBottom: "8px" }}>{t("rapann_exportTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "12px" }}>{t("rapann_exportDescription")}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className={styles.bouton} onClick={() => telecharger("pdf")} disabled={telechargementEnCours !== null}>
            {telechargementEnCours === "pdf" ? t("dossier_genererEnCours") : t("rapann_telechargerPdf")}
          </button>
          <button className={styles.bouton} onClick={() => telecharger("docx")} disabled={telechargementEnCours !== null}>
            {telechargementEnCours === "docx" ? t("dossier_genererEnCours") : t("rapann_telechargerWord")}
          </button>
          <button className={styles.bouton} onClick={() => telecharger("pptx")} disabled={telechargementEnCours !== null}>
            {telechargementEnCours === "pptx" ? t("dossier_genererEnCours") : t("rapann_telechargerPowerpoint")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRapportAnnuelPage() {
  return (
    <AdminShell>
      <RapportAnnuelPlateformeContenu />
    </AdminShell>
  );
}
