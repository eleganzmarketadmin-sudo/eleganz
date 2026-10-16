"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
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

// Rapport annuel (demande du 16 oct. 2026, point 3) — aux normes
// professionnelles internationales (SYSCOHADA/OHADA, déjà la base
// comptable ELEGANZ), exportable en PDF, Word et PowerPoint. Assemblé à la
// volée depuis les écritures comptables réelles de l'année choisie, jamais
// persisté.
function RapportAnnuelContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const [apercu, setApercu] = useState<RapportAnnuelApercu | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    api
      .get<RapportAnnuelApercu>(`/shops/${currentShop.id}/finance/rapport-annuel?annee=${annee}`)
      .then(setApercu)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [currentShop?.id, annee, t]);

  async function telecharger(format: "pdf" | "docx" | "pptx") {
    if (!currentShop) return;
    setTelechargementEnCours(format);
    setErreur(null);
    try {
      if (format === "pdf") {
        await ouvrirDocumentPdf(`/shops/${currentShop.id}/finance/export/rapport-annuel?annee=${annee}&format=pdf`);
      } else {
        await telechargerFichier(
          `/shops/${currentShop.id}/finance/export/rapport-annuel?annee=${annee}&format=${format}`,
          `rapport-annuel-${annee}.${format}`,
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
      <h1 className={styles.titre}>{t("rapann_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-4)" }}>
        {t("rapann_sousTitre")}
      </p>

      <div className={styles.champ} style={{ maxWidth: "200px", marginBottom: "var(--espace-4)" }}>
        <label>{t("rapann_labelAnnee")}</label>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ padding: "var(--espace-3)", border: "2px solid var(--color-ink)", width: "100%" }}>
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
        <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
          <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("rapann_chiffresClesTitre")}</h2>
          <table className={styles.tableau}>
            <tbody>
              <tr>
                <td>{t("rapann_chiffreAffaires")}</td>
                <td className="chiffre">{f(apercu.chiffresCles.chiffreAffaires)}</td>
              </tr>
              <tr>
                <td>{t("rapann_charges")}</td>
                <td className="chiffre">{f(apercu.chiffresCles.charges)}</td>
              </tr>
              <tr>
                <td>{t("rapann_resultatNet")}</td>
                <td className="chiffre">{f(apercu.chiffresCles.resultatNet)}</td>
              </tr>
              <tr>
                <td>{t("rapann_margeNette")}</td>
                <td className="chiffre">{fPct(apercu.chiffresCles.margeNette)}</td>
              </tr>
              <tr>
                <td>{t("rapann_croissanceCA")}</td>
                <td className="chiffre">{fPct(apercu.chiffresCles.croissanceCA)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)" }}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("rapann_exportTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
          {t("rapann_exportDescription")}
        </p>
        <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap" }}>
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

export default function RapportAnnuelPage() {
  return (
    <ProtectedGestionPage>
      <RapportAnnuelContenu />
    </ProtectedGestionPage>
  );
}
