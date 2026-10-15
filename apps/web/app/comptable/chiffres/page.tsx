"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { GraphiqueEvolution, GraphiqueComparaison } from "./Graphiques";
import styles from "./page.module.css";

function debutMoisCourant(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Periode {
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

interface Dashboard {
  activites: number;
  jour: Periode;
  semaine: Periode;
  mois: Periode;
  annee: Periode;
  dettesRestantes: Record<string, number>;
  creancesRestantes: Record<string, number>;
  nombreDettesEnCours: number;
  nombreCreancesEnCours: number;
}

function CartePeriode({ titre, periode }: { titre: string; periode: Periode }) {
  const { t } = useLocale();
  const soldeCdf = periode.ventesCdf - periode.depensesCdf;
  const soldeUsd = periode.ventesUsd - periode.depensesUsd;
  return (
    <div className={styles.cartePeriode}>
      <div className={styles.cartePeriodeTitre}>{titre}</div>
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_ventes")} CDF</span>
        <span>{formatMoney(periode.ventesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_depenses")} CDF</span>
        <span>{formatMoney(periode.depensesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_resultatEstime")} CDF</span>
        <span className={soldeCdf >= 0 ? styles.soldePositif : styles.soldeNegatif}>
          {formatMoney(soldeCdf, "CDF")}
        </span>
      </div>
      <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_ventes")} USD</span>
        <span>{formatMoney(periode.ventesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_depenses")} USD</span>
        <span>{formatMoney(periode.depensesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>{t("chiffres_resultatEstime")} USD</span>
        <span className={soldeUsd >= 0 ? styles.soldePositif : styles.soldeNegatif}>
          {formatMoney(soldeUsd, "USD")}
        </span>
      </div>
    </div>
  );
}

interface PointHistorique {
  date: string;
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

interface LigneComparaison {
  activityId: string;
  activityName: string;
  resultatCdf: number;
  resultatUsd: number;
}

function ChiffresContenu() {
  const { t } = useLocale();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [historique, setHistorique] = useState<PointHistorique[]>([]);
  const [comparaison, setComparaison] = useState<LigneComparaison[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [exportDe, setExportDe] = useState(debutMoisCourant());
  const [exportA, setExportA] = useState(aujourdHui());
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  async function exporterSynthese(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    setErreurExport(null);
    try {
      const params = new URLSearchParams({
        from: new Date(exportDe).toISOString(),
        to: new Date(new Date(exportA).getTime() + 86_400_000).toISOString(),
        format,
      });
      const path = `/comptable/export/synthese?${params.toString()}`;
      if (format === "xlsx") {
        await telechargerFichier(path, "synthese-mon-comptable.xlsx");
      } else {
        await ouvrirDocumentPdf(path);
      }
    } catch (err) {
      setErreurExport(err instanceof Error ? err.message : t("chiffres_exportImpossible"));
    } finally {
      setExportEnCours(null);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Dashboard>("/comptable/dashboard"),
      api.get<PointHistorique[]>("/comptable/dashboard/historique?jours=14"),
      api.get<LigneComparaison[]>("/comptable/dashboard/comparaison"),
    ])
      .then(([d, h, c]) => {
        setDashboard(d);
        setHistorique(h);
        setComparaison(c);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!dashboard) return null;

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_chiffres")}</h1>
      <p className={styles.sousTitre}>
        {t("chiffres_sousTitre").replace("{{nombre}}", String(dashboard.activites))}
      </p>

      <div className={styles.grillePeriodes}>
        <CartePeriode titre={t("periode_aujourdhui")} periode={dashboard.jour} />
        <CartePeriode titre={t("periode_semaine")} periode={dashboard.semaine} />
        <CartePeriode titre={t("periode_mois")} periode={dashboard.mois} />
        <CartePeriode titre={t("periode_annee")} periode={dashboard.annee} />
      </div>

      {historique.length > 0 && (
        <>
          <h2 className={styles.sectionTitre}>{t("chiffres_evolution")}</h2>
          <GraphiqueEvolution items={historique} currency="USD" />
          <GraphiqueEvolution items={historique} currency="CDF" />
        </>
      )}

      {comparaison.length > 1 && (
        <>
          <h2 className={styles.sectionTitre}>{t("chiffres_comparaisonActivites")}</h2>
          <GraphiqueComparaison items={comparaison} currency="USD" />
          <GraphiqueComparaison items={comparaison} currency="CDF" />
        </>
      )}

      <h2 className={styles.sectionTitre}>{t("chiffres_dettesCreances")}</h2>
      <div className={styles.grillePeriodes}>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>{t("chiffres_dettes")} ({dashboard.nombreDettesEnCours})</div>
          {Object.entries(dashboard.dettesRestantes).length === 0 ? (
            <p>{t("chiffres_aucuneDette")}</p>
          ) : (
            Object.entries(dashboard.dettesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>{t("chiffres_soldeRestant")}</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>{t("chiffres_creances")} ({dashboard.nombreCreancesEnCours})</div>
          {Object.entries(dashboard.creancesRestantes).length === 0 ? (
            <p>{t("chiffres_aucuneCreance")}</p>
          ) : (
            Object.entries(dashboard.creancesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>{t("chiffres_soldeRestant")}</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <h2 className={styles.sectionTitre}>{t("chiffres_exporterSynthese")}</h2>
      {erreurExport && <p className={styles.erreur}>{erreurExport}</p>}
      <div className={styles.exportZone}>
        <label className={styles.exportChamp}>
          <span>{t("commun_du")}</span>
          <input type="date" value={exportDe} onChange={(e) => setExportDe(e.target.value)} />
        </label>
        <label className={styles.exportChamp}>
          <span>{t("commun_au")}</span>
          <input type="date" value={exportA} onChange={(e) => setExportA(e.target.value)} />
        </label>
        <button
          className={styles.boutonExport}
          onClick={() => exporterSynthese("xlsx")}
          disabled={exportEnCours !== null}
        >
          {exportEnCours === "xlsx" ? "…" : t("action_exporterExcel")}
        </button>
        <button
          className={styles.boutonExport}
          onClick={() => exporterSynthese("pdf")}
          disabled={exportEnCours !== null}
        >
          {exportEnCours === "pdf" ? "…" : t("action_exporterPdf")}
        </button>
      </div>

      <p className={styles.note}>
        {t("chiffres_noteDeclarative")}{" "}
        <Link href="/comptable/dossier-financement">{t("chiffres_dossierFinancement")}</Link>
      </p>
    </div>
  );
}

export default function ComptableChiffresPage() {
  return (
    <ComptableShell>
      <ChiffresContenu />
    </ComptableShell>
  );
}
