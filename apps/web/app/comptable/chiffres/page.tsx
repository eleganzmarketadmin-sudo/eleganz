"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../lib/pdf";
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
  const soldeCdf = periode.ventesCdf - periode.depensesCdf;
  const soldeUsd = periode.ventesUsd - periode.depensesUsd;
  return (
    <div className={styles.cartePeriode}>
      <div className={styles.cartePeriodeTitre}>{titre}</div>
      <div className={styles.cartePeriodeLigne}>
        <span>Ventes CDF</span>
        <span>{formatMoney(periode.ventesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Dépenses CDF</span>
        <span>{formatMoney(periode.depensesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Résultat estimé CDF</span>
        <span className={soldeCdf >= 0 ? styles.soldePositif : styles.soldeNegatif}>
          {formatMoney(soldeCdf, "CDF")}
        </span>
      </div>
      <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />
      <div className={styles.cartePeriodeLigne}>
        <span>Ventes USD</span>
        <span>{formatMoney(periode.ventesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Dépenses USD</span>
        <span>{formatMoney(periode.depensesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Résultat estimé USD</span>
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
      setErreurExport(err instanceof Error ? err.message : "Export impossible.");
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p>Chargement…</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!dashboard) return null;

  return (
    <div>
      <h1 className={styles.titre}>Mon activité en chiffres</h1>
      <p className={styles.sousTitre}>
        Calculé à partir des {dashboard.activites} activité(s) enregistrée(s) — jamais une donnée inventée.
      </p>

      <div className={styles.grillePeriodes}>
        <CartePeriode titre="Aujourd'hui" periode={dashboard.jour} />
        <CartePeriode titre="Cette semaine" periode={dashboard.semaine} />
        <CartePeriode titre="Ce mois-ci" periode={dashboard.mois} />
        <CartePeriode titre="Cette année" periode={dashboard.annee} />
      </div>

      {historique.length > 0 && (
        <>
          <h2 className={styles.sectionTitre}>Évolution</h2>
          <GraphiqueEvolution items={historique} currency="USD" />
          <GraphiqueEvolution items={historique} currency="CDF" />
        </>
      )}

      {comparaison.length > 1 && (
        <>
          <h2 className={styles.sectionTitre}>Comparaison entre activités</h2>
          <GraphiqueComparaison items={comparaison} currency="USD" />
          <GraphiqueComparaison items={comparaison} currency="CDF" />
        </>
      )}

      <h2 className={styles.sectionTitre}>Dettes, créances et emprunts en cours</h2>
      <div className={styles.grillePeriodes}>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>Dettes ({dashboard.nombreDettesEnCours})</div>
          {Object.entries(dashboard.dettesRestantes).length === 0 ? (
            <p>Aucune dette en cours.</p>
          ) : (
            Object.entries(dashboard.dettesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>Solde restant</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>Créances ({dashboard.nombreCreancesEnCours})</div>
          {Object.entries(dashboard.creancesRestantes).length === 0 ? (
            <p>Aucune créance en cours.</p>
          ) : (
            Object.entries(dashboard.creancesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>Solde restant</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <h2 className={styles.sectionTitre}>Exporter une synthèse</h2>
      {erreurExport && <p className={styles.erreur}>{erreurExport}</p>}
      <div className={styles.exportZone}>
        <label className={styles.exportChamp}>
          <span>Du</span>
          <input type="date" value={exportDe} onChange={(e) => setExportDe(e.target.value)} />
        </label>
        <label className={styles.exportChamp}>
          <span>Au</span>
          <input type="date" value={exportA} onChange={(e) => setExportA(e.target.value)} />
        </label>
        <button
          className={styles.boutonExport}
          onClick={() => exporterSynthese("xlsx")}
          disabled={exportEnCours !== null}
        >
          {exportEnCours === "xlsx" ? "…" : "Exporter en Excel"}
        </button>
        <button
          className={styles.boutonExport}
          onClick={() => exporterSynthese("pdf")}
          disabled={exportEnCours !== null}
        >
          {exportEnCours === "pdf" ? "…" : "Exporter en PDF"}
        </button>
      </div>

      <p className={styles.note}>
        Ces chiffres sont calculés à partir de vos saisies déclaratives. Ils ne constituent pas un état
        financier certifié ni un relevé bancaire officiel.{" "}
        <Link href="/comptable/dossier-financement">Besoin d&apos;un dossier pour une demande de financement ?</Link>
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
