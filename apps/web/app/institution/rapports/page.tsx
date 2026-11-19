"use client";

import { useEffect, useState } from "react";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface VentilationRisqueLigne {
  nombre: number;
  soldeRestant: number;
  provisionRequise: number;
}

interface RapportPortefeuille {
  genereLe: string;
  capitalTotalEnCours: number;
  provisionRequiseTotal: number;
  nombrePretsActifs: number;
  nombrePretsTermines: number;
  ventilationRisque: Record<"SAIN" | "SOUS_SURVEILLANCE" | "DOUTEUX" | "COMPROMIS", VentilationRisqueLigne>;
  tauxDefautCapital: number | null;
  tauxDefautNombre: number | null;
}

const CLASSIFICATIONS = ["SAIN", "SOUS_SURVEILLANCE", "DOUTEUX", "COMPROMIS"] as const;

function badgeClasseRisque(classification: (typeof CLASSIFICATIONS)[number], styles: Record<string, string>): string | null {
  if (classification === "SOUS_SURVEILLANCE") return styles.badgeAttention;
  if (classification === "DOUTEUX" || classification === "COMPROMIS") return styles.badgeRefuse;
  return null;
}

function formaterPourcentage(valeur: number | null): string {
  if (valeur === null) return "—";
  return `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/**
 * Rapport de portefeuille (écran RAPPORTS, 19 nov. 2026, demande du
 * propriétaire — voir RapportPortefeuilleService côté API). Purement
 * informatif, comme le reste du chantier "gestion de risque autonome" :
 * ELEGANZ Market reste un facilitateur, jamais une institution financière,
 * cet écran n'impose ni ne bloque aucune décision de l'institution.
 */
function RapportsContenu() {
  const { t } = useLocale();
  const [rapport, setRapport] = useState<RapportPortefeuille | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState<"pdf" | "excel" | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RapportPortefeuille>("/institution-portal/rapports/portefeuille")
      .then(setRapport)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function telechargerPdf() {
    setExportEnCours("pdf");
    setErreurExport(null);
    try {
      await ouvrirDocumentPdf("/institution-portal/rapports/portefeuille/export");
    } catch (err) {
      setErreurExport(err instanceof Error ? err.message : t("inst_erreurGeneration"));
    } finally {
      setExportEnCours(null);
    }
  }

  async function telechargerExcel() {
    setExportEnCours("excel");
    setErreurExport(null);
    try {
      await telechargerFichier("/institution-portal/rapports/portefeuille/export-excel", "rapport-portefeuille.xlsx");
    } catch (err) {
      setErreurExport(err instanceof Error ? err.message : t("inst_erreurGeneration"));
    } finally {
      setExportEnCours(null);
    }
  }

  if (erreur) return <div className={styles.erreur}>{erreur}</div>;
  if (!rapport) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_rapportsTitre")}</h1>

      {erreurExport && <div className={styles.erreur}>{erreurExport}</div>}
      <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", marginBottom: "var(--espace-4)" }}>
        <button className={styles.bouton} onClick={telechargerPdf} disabled={exportEnCours !== null}>
          {exportEnCours === "pdf" ? t("dossier_genererEnCours") : t("dossier_telechargerPdf")}
        </button>
        <button className={styles.boutonSecondaire} onClick={telechargerExcel} disabled={exportEnCours !== null} type="button">
          {exportEnCours === "excel" ? t("dossier_genererEnCours") : t("inst_rapportsTelechargerExcel")}
        </button>
      </div>

      <div className={styles.carte}>
        <table className={styles.tableau}>
          <tbody>
            <tr>
              <td>{t("inst_rapportsCapitalEnCours")}</td>
              <td className="chiffre">{rapport.capitalTotalEnCours.toLocaleString("fr-FR")}</td>
            </tr>
            <tr>
              <td>{t("inst_colProvisionRequise")}</td>
              <td className="chiffre">{rapport.provisionRequiseTotal.toLocaleString("fr-FR")}</td>
            </tr>
            <tr>
              <td>{t("inst_rapportsNombrePretsActifs")}</td>
              <td className="chiffre">{rapport.nombrePretsActifs}</td>
            </tr>
            <tr>
              <td>{t("inst_rapportsNombrePretsTermines")}</td>
              <td className="chiffre">{rapport.nombrePretsTermines}</td>
            </tr>
            <tr>
              <td>{t("inst_rapportsTauxDefautCapital")}</td>
              <td className="chiffre">{formaterPourcentage(rapport.tauxDefautCapital)}</td>
            </tr>
            <tr>
              <td>{t("inst_rapportsTauxDefautNombre")}</td>
              <td className="chiffre">{formaterPourcentage(rapport.tauxDefautNombre)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.carte}>
        <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("inst_rapportsVentilationTitre")}</h2>
        {rapport.nombrePretsActifs === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_rapportsAucunPretActif")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <td>{t("inst_colClassification")}</td>
                <td>{t("inst_colNombrePrets")}</td>
                <td>{t("inst_colSoldeRestant")}</td>
                <td>{t("inst_colProvisionRequise")}</td>
              </tr>
            </thead>
            <tbody>
              {CLASSIFICATIONS.map((cle) => {
                const ligne = rapport.ventilationRisque[cle];
                const classeBadge = badgeClasseRisque(cle, styles);
                return (
                  <tr key={cle}>
                    <td>
                      {classeBadge ? (
                        <span className={`${styles.badge} ${classeBadge}`}>{t(`inst_risqueClassification_${cle}`)}</span>
                      ) : (
                        t(`inst_risqueClassification_${cle}`)
                      )}
                    </td>
                    <td className="chiffre">{ligne.nombre}</td>
                    <td className="chiffre">{ligne.soldeRestant.toLocaleString("fr-FR")}</td>
                    <td className="chiffre">{ligne.provisionRequise.toLocaleString("fr-FR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: "var(--espace-3)", fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>
          {t("inst_rapportsGenereLe")} {new Date(rapport.genereLe).toLocaleString("fr-FR")}
        </p>
      </div>
    </div>
  );
}

export default function RapportsPage() {
  return (
    <InstitutionShell>
      <RapportsContenu />
    </InstitutionShell>
  );
}
