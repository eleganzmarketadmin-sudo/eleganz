"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { StatusTag } from "../../components/StatusTag";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { EvolutionChart } from "../EvolutionChart";
import { CompteurAnime } from "../CompteurAnime";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Répartition par module (16 nov. 2026, refonte du Centre de pilotage) —
// voir AdminCockpitService.executiveDashboard / repartirFacturation
// (apps/api/src/billing/revenue-breakdown.util.ts). enAttente/enRetard
// valent `null` pour les modules sans cycle de facturation (Caisse,
// Institutions) : le frontend n'affiche alors que facturé/encaissé.
interface ModuleRevenu {
  cle: "gestion" | "marketplace" | "livreur" | "secourable" | "caisse" | "institutions";
  typeRevenu: "abonnement" | "commission" | "valeur_vendeur";
  facture: number;
  encaisse: number;
  enAttente: number | null;
  enRetard: number | null;
}

const CLES_MODULE: Record<ModuleRevenu["cle"], string> = {
  gestion: "admpilot_mod_gestion",
  marketplace: "admfinance_commissionMarketplace",
  livreur: "admpilot_mod_livreur",
  secourable: "admpilot_mod_secourable",
  caisse: "admpilot_mod_caisse",
  institutions: "admpilot_mod_institutions",
};

interface Dashboard {
  activity: {
    totalShops: number;
    shopsByStatus: Record<string, number>;
    activeShops: number;
    freeShops: number;
    suspendedShops: number;
    totalVendors: number;
    totalProducts: number;
    productsOutOfStock: number;
    ordersByStatus: Record<string, number>;
  };
  revenue: {
    grossOrderValue: number;
    platformRevenueByKind: Record<string, number>;
    pendingInvoicesAmount: number;
    modules: ModuleRevenu[];
  };
  operations: { openDisputes: number };
  aiUsage: { note?: string };
}

interface Evolution {
  jours: string[];
  nouvellesBoutiques: number[];
  nouveauxProduits: number[];
  commandes: number[];
  valeurCommandes: number[];
  revenuPlateforme: number[];
}

function PilotageContent() {
  const { t } = useLocale();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);

  async function exporter(cle: "boutiques" | "produits" | "commandes" | "factures", nomFichier: string) {
    setExportEnCours(cle);
    setErreur(null);
    try {
      await telechargerFichier(`/admin/exports/${cle}`, nomFichier);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("chiffres_exportImpossible"));
    } finally {
      setExportEnCours(null);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Dashboard>("/admin/cockpit/executive-dashboard"),
      api.get<Evolution>("/admin/cockpit/evolution?days=30"),
    ])
      .then(([d, e]) => {
        setDashboard(d);
        setEvolution(e);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  if (chargement) return <p>{t("admpilot_chargementTableauBord")}</p>;
  if (erreur) return <p>{erreur}</p>;
  if (!dashboard) return null;

  const revenuPlatformeTotal = Object.values(dashboard.revenue.platformRevenueByKind).reduce(
    (s, v) => s + v,
    0,
  );

  return (
    <div>
      <h1 className={styles.titre}>{t("admpilot_titre")}</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("commun_activite")}</h2>
        <div className={styles.grille}>
          <div className={`${styles.carte} ${styles.carteCobalt}`}>
            <span className={styles.carteLabel}>{t("nav_boutiques")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_actives")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.activeShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_enPeriodeGratuite")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.freeShops} /></span>
          </div>
          <div className={`${styles.carte} ${dashboard.activity.suspendedShops > 0 ? styles.carteFlamme : ""}`}>
            <span className={styles.carteLabel}>{t("admpilot_suspendues")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.suspendedShops} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_vendeurs")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalVendors} /></span>
          </div>
          <div className={`${styles.carte} ${styles.carteMagenta}`}>
            <span className={styles.carteLabel}>{t("admpilot_articlesCatalogue")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.totalProducts} /></span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_articlesEpuises")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.activity.productsOutOfStock} /></span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("admpilot_exportsExcel")}</h2>
        <p className={styles.noteRevenu}>{t("admpilot_noteExports")}</p>
        <div className={styles.exports}>
          <button className={styles.boutonExport} onClick={() => exporter("boutiques", "boutiques-eleganz.xlsx")} disabled={exportEnCours !== null}>
            {exportEnCours === "boutiques" ? "…" : t("admpilot_exportBoutiques")}
          </button>
          <button className={styles.boutonExport} onClick={() => exporter("produits", "produits-eleganz.xlsx")} disabled={exportEnCours !== null}>
            {exportEnCours === "produits" ? "…" : t("admpilot_exportProduits")}
          </button>
          <button className={styles.boutonExport} onClick={() => exporter("commandes", "commandes-eleganz.xlsx")} disabled={exportEnCours !== null}>
            {exportEnCours === "commandes" ? "…" : t("admpilot_exportCommandes")}
          </button>
          <button className={styles.boutonExport} onClick={() => exporter("factures", "factures-plateforme-eleganz.xlsx")} disabled={exportEnCours !== null}>
            {exportEnCours === "factures" ? "…" : t("admpilot_exportFactures")}
          </button>
        </div>
      </div>

      {evolution && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitre}>{t("admpilot_evolution30Jours")}</h2>
          <div className={styles.grilleGraphiques}>
            <EvolutionChart
              titre={t("admpilot_graphNouvellesBoutiques")}
              jours={evolution.jours}
              valeurs={evolution.nouvellesBoutiques}
              couleur="var(--color-cobalt)"
              style="barres"
            />
            <EvolutionChart
              titre={t("admpilot_graphNouveauxArticles")}
              jours={evolution.jours}
              valeurs={evolution.nouveauxProduits}
              couleur="var(--color-magenta)"
              style="barres"
            />
            <EvolutionChart
              titre={t("admpilot_graphCommandesMarketplace")}
              jours={evolution.jours}
              valeurs={evolution.commandes}
              couleur="var(--color-flamme)"
              style="barres"
            />
            <EvolutionChart
              titre={t("admpilot_valeurBrute")}
              jours={evolution.jours}
              valeurs={evolution.valeurCommandes}
              couleur="var(--color-or)"
              formater={(n) => formatMoney(n)}
            />
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("admpilot_commandesParStatut")}</h2>
        <div className={styles.grille}>
          {Object.entries(dashboard.activity.ordersByStatus).length === 0 ? (
            <div className={styles.carte}>
              <span className={styles.carteLabel}>{t("admpilot_aucuneCommandeEncore")}</span>
            </div>
          ) : (
            Object.entries(dashboard.activity.ordersByStatus).map(([statut, n]) => (
              <div className={styles.carte} key={statut}>
                <span className={styles.carteLabel}>{statut}</span>
                <span className={styles.carteValeur}><CompteurAnime valeur={n} /></span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("admpilot_revenus")}</h2>
        <p className={styles.noteRevenu}>{t("admpilot_noteRevenus")}</p>
        <div className={styles.grille}>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_valeurBrute")}</span>
            <span className={styles.carteValeur}>{formatMoney(dashboard.revenue.grossOrderValue)}</span>
          </div>
          <div className={`${styles.carte} ${styles.carteOr}`}>
            <span className={styles.carteLabel}>{t("admpilot_revenuEleganz")}</span>
            <span className={styles.carteValeur}>{formatMoney(revenuPlatformeTotal)}</span>
          </div>
          <div className={styles.carte}>
            <span className={styles.carteLabel}>{t("admpilot_facturesEnAttente")}</span>
            <span className={styles.carteValeur}>
              {formatMoney(dashboard.revenue.pendingInvoicesAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("admpilot_revenusParModule")}</h2>
        <div className={styles.grilleModules}>
          {dashboard.revenue.modules.map((m) => {
            const suiviCycle = m.enAttente !== null && m.enRetard !== null;
            const humeur = !suiviCycle ? "neutre" : (m.enRetard ?? 0) > 0 ? "alerte" : (m.enAttente ?? 0) > 0 ? "attente" : "paye";
            const label = suiviCycle
              ? humeur === "alerte"
                ? t("admpilot_colEnRetard")
                : humeur === "attente"
                  ? t("admpilot_colEnAttente")
                  : t("admfact_statutPayee")
              : t("admpilot_colEncaisse");
            return (
              <div className={styles.carteModule} key={m.cle}>
                <div className={styles.carteModuleEntete}>
                  <span className={styles.carteModuleTitre}>{t(CLES_MODULE[m.cle])}</span>
                  <StatusTag label={label} humeur={humeur} />
                </div>
                <div className={styles.carteModuleLigne}>
                  <span className={styles.carteModuleLabel}>{t("admpilot_colFacture")}</span>
                  <span className={styles.carteModuleValeur}>{formatMoney(m.facture)}</span>
                </div>
                <div className={styles.carteModuleLigne}>
                  <span className={styles.carteModuleLabel}>{t("admpilot_colEncaisse")}</span>
                  <span className={styles.carteModuleValeur}>{formatMoney(m.encaisse)}</span>
                </div>
                {suiviCycle && (
                  <>
                    <div className={styles.carteModuleLigne}>
                      <span className={styles.carteModuleLabel}>{t("admpilot_colEnAttente")}</span>
                      <span className={styles.carteModuleValeur}>{formatMoney(m.enAttente ?? 0)}</span>
                    </div>
                    <div className={styles.carteModuleLigne}>
                      <span className={styles.carteModuleLabel}>{t("admpilot_colEnRetard")}</span>
                      <span className={styles.carteModuleValeur}>{formatMoney(m.enRetard ?? 0)}</span>
                    </div>
                  </>
                )}
                {m.typeRevenu === "valeur_vendeur" && <p className={styles.carteModuleNote}>{t("admpilot_noteValeurVendeur")}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {evolution && (
        <div className={styles.section}>
          <EvolutionChart
            titre={t("admpilot_revenuPlateformeEncaisse")}
            jours={evolution.jours}
            valeurs={evolution.revenuPlateforme}
            couleur="var(--color-vert-paiement)"
            formater={(n) => formatMoney(n)}
          />
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>{t("nav_litiges")}</h2>
        <div className={styles.grille}>
          <div className={`${styles.carte} ${dashboard.operations.openDisputes > 0 ? styles.carteFlamme : ""}`}>
            <span className={styles.carteLabel}>{t("admpilot_litigesOuverts")}</span>
            <span className={styles.carteValeur}><CompteurAnime valeur={dashboard.operations.openDisputes} /></span>
          </div>
        </div>
      </div>

      {dashboard.aiUsage.note && <div className={styles.note}>{dashboard.aiUsage.note}</div>}
    </div>
  );
}

export default function PilotagePage() {
  return (
    <AdminShell>
      <PilotageContent />
    </AdminShell>
  );
}
