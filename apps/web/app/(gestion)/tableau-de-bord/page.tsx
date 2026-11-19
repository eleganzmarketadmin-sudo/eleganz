"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { GrapheCaMarge, GrapheVentes, TableauEvolution, type PointEvolution } from "./EvolutionCharts";
import styles from "./page.module.css";

type Preset = "7j" | "30j" | "12sem" | "12mois";

interface Evolution {
  granularite: "JOUR" | "SEMAINE" | "MOIS";
  from: string;
  to: string;
  points: PointEvolution[];
  totaux: {
    revenue: number;
    salesCount: number;
    panierMoyen: number;
    grossMargin: number | null;
  };
}

// Traduit un préréglage d'affichage en paramètres de requête pour
// GET /pos/dashboard/evolution — calculé côté client (pas besoin d'aller-
// retour serveur juste pour connaître la date du jour).
function parametresPreset(preset: Preset): { from: string; to: string; granularite: "JOUR" | "SEMAINE" | "MOIS" } {
  const aujourdHui = new Date();
  const to = aujourdHui.toISOString().slice(0, 10);
  const debut = new Date(aujourdHui);
  if (preset === "7j") {
    debut.setDate(debut.getDate() - 6);
    return { from: debut.toISOString().slice(0, 10), to, granularite: "JOUR" };
  }
  if (preset === "30j") {
    debut.setDate(debut.getDate() - 29);
    return { from: debut.toISOString().slice(0, 10), to, granularite: "JOUR" };
  }
  if (preset === "12sem") {
    debut.setDate(debut.getDate() - 7 * 11);
    return { from: debut.toISOString().slice(0, 10), to, granularite: "SEMAINE" };
  }
  // 12mois
  debut.setMonth(debut.getMonth() - 11);
  return { from: debut.toISOString().slice(0, 10), to, granularite: "MOIS" };
}

interface Dashboard {
  date: string;
  salesCount: number;
  revenue: number;
  confirmedCollections: number;
  grossMargin: number | null;
  marginReliable: boolean;
  note?: string;
}

interface EcartStock {
  id: string;
  label: string;
  quantity: number;
  sale: { id: string; createdAt: string };
  variant?: { sku: string } | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function DashboardContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [date, setDate] = useState(todayIso());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecartsStock, setEcartsStock] = useState<EcartStock[]>([]);

  const [preset, setPreset] = useState<Preset>("30j");
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [chargementEvolution, setChargementEvolution] = useState(true);
  const [erreurEvolution, setErreurEvolution] = useState<string | null>(null);
  const [vueTableau, setVueTableau] = useState(false);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    api
      .get<Dashboard>(`/shops/${currentShop.id}/pos/dashboard/daily?date=${date}`)
      .then((data) => {
        if (!annule) setDashboard(data);
      })
      .catch((err) => {
        if (!annule) {
          setErreur(
            err instanceof ApiError && err.statusCode === 403
              ? t("tdb_reserveRole")
              : err instanceof Error
                ? err.message
                : t("cmd_erreurGenerique"),
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop, date]);

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<EcartStock[]>(`/shops/${currentShop.id}/pos/stock-discrepancies`)
      .then(setEcartsStock)
      .catch(() => setEcartsStock([]));
  }, [currentShop]);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    const { from, to, granularite } = parametresPreset(preset);
    setChargementEvolution(true);
    setErreurEvolution(null);
    api
      .get<Evolution>(
        `/shops/${currentShop.id}/pos/dashboard/evolution?from=${from}&to=${to}&granularite=${granularite}`,
      )
      .then((data) => {
        if (!annule) setEvolution(data);
      })
      .catch((err) => {
        if (!annule) setErreurEvolution(err instanceof ApiError ? err.message : t("tdbevo_erreurChargement"));
      })
      .finally(() => {
        if (!annule) setChargementEvolution(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop, preset]);

  const margeIncomplete = useMemo(
    () => (evolution ? evolution.points.some((p) => !p.marginReliable) : false),
    [evolution],
  );

  return (
    <div>
      <h1 className={styles.titre}>{t("tdb_titre")}</h1>
      <p className={styles.selecteurDate}>
        {t("tdb_journeeDu")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </p>

      {chargement && <p>{t("commun_chargement")}</p>}
      {erreur && <p>{erreur}</p>}

      {dashboard && (
        <>
          {dashboard.note && <div className={styles.note}>{dashboard.note}</div>}

          <div className={styles.grille}>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>{t("tdb_ventes")}</span>
              <span className={styles.carteValeur}>{dashboard.salesCount}</span>
            </div>
            <div className={`${styles.carte} ${styles.carteEncre}`}>
              <span className={styles.carteLabel}>{t("tdb_chiffreAffaires")}</span>
              <span className={styles.carteValeur}>{formatMoney(dashboard.revenue)}</span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>{t("tdb_encaissementsConfirmes")}</span>
              <span className={styles.carteValeur}>
                {formatMoney(dashboard.confirmedCollections)}
              </span>
            </div>
            <div className={styles.carte}>
              <span className={styles.carteLabel}>
                {t("tdb_margeBrute")}
                {!dashboard.marginReliable && ` ${t("tdb_margeIncomplete")}`}
              </span>
              <span className={styles.carteValeur}>
                {dashboard.grossMargin != null ? formatMoney(dashboard.grossMargin) : "—"}
              </span>
            </div>
          </div>

          <p style={{ color: "#555", fontSize: "0.875rem" }}>{t("tdb_noteMarge")}</p>
        </>
      )}

      <div className={styles.sectionEvolution}>
        <div className={styles.evolutionEntete}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>{t("tdbevo_titreSection")}</h2>
          <div className={styles.selecteurPeriode}>
            {(["7j", "30j", "12sem", "12mois"] as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.boutonPeriode} ${preset === p ? styles.boutonPeriodeActif : ""}`}
                onClick={() => setPreset(p)}
              >
                {t(`tdbevo_periode${p}`)}
              </button>
            ))}
          </div>
        </div>

        {chargementEvolution && <p>{t("commun_chargement")}</p>}
        {erreurEvolution && <p>{erreurEvolution}</p>}

        {evolution && !chargementEvolution && (
          <>
            <div className={styles.resume}>
              <div className={styles.resumeCarte}>
                <span className={styles.resumeLabel}>{t("tdbevo_resumeCa")}</span>
                <span className={styles.resumeValeur}>{formatMoney(evolution.totaux.revenue)}</span>
              </div>
              <div className={styles.resumeCarte}>
                <span className={styles.resumeLabel}>{t("tdbevo_resumeVentes")}</span>
                <span className={styles.resumeValeur}>{evolution.totaux.salesCount}</span>
              </div>
              <div className={styles.resumeCarte}>
                <span className={styles.resumeLabel}>{t("tdbevo_resumePanier")}</span>
                <span className={styles.resumeValeur}>{formatMoney(evolution.totaux.panierMoyen)}</span>
              </div>
              <div className={styles.resumeCarte}>
                <span className={styles.resumeLabel}>{t("tdbevo_resumeMarge")}</span>
                <span className={styles.resumeValeur}>
                  {evolution.totaux.grossMargin != null ? formatMoney(evolution.totaux.grossMargin) : "—"}
                </span>
              </div>
            </div>

            {evolution.points.length === 0 ? (
              <p style={{ color: "#888", fontSize: "0.875rem" }}>{t("tdbevo_aucuneDonnee")}</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                  <button
                    type="button"
                    className={styles.boutonBascule}
                    onClick={() => setVueTableau((v) => !v)}
                  >
                    {vueTableau ? t("tdbevo_voirGraphique") : t("tdbevo_voirTableau")}
                  </button>
                </div>

                {vueTableau ? (
                  <TableauEvolution points={evolution.points} />
                ) : (
                  <>
                    <div className={styles.sousGraphe}>
                      <div className={styles.sousGrapheTitre}>{t("tdbevo_graphCaTitre")}</div>
                      <GrapheCaMarge points={evolution.points} />
                    </div>
                    <div className={styles.sousGraphe}>
                      <div className={styles.sousGrapheTitre}>{t("tdbevo_graphVentesTitre")}</div>
                      <GrapheVentes points={evolution.points} />
                    </div>
                  </>
                )}

                {margeIncomplete && <p className={styles.margeNote}>{t("tdbevo_noteMargeIncomplete")}</p>}
              </>
            )}
          </>
        )}
      </div>

      {ecartsStock.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "12px" }}>
            {t("tdb_ecartsStockTitre")} ({ecartsStock.length})
          </h2>
          <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "12px" }}>
            {t("tdb_ecartsStockNote")}
          </p>
          <div className={styles.note}>
            {ecartsStock.map((e) => (
              <div key={e.id} style={{ marginBottom: "4px" }}>
                {e.label} ({e.variant?.sku ?? t("tdb_sansReference")}) × {e.quantity} —{" "}
                {new Date(e.sale.createdAt).toLocaleString("fr-FR")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TableauDeBordPage() {
  return (
    <ProtectedGestionPage>
      <DashboardContent />
    </ProtectedGestionPage>
  );
}
