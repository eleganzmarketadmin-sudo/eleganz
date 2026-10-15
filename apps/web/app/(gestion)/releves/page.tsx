"use client";

import { useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface CelluleReleve {
  montantUSD: number;
  montantCDF: number;
  quantite: number;
  ventesCount: number;
}

interface ReleveActivite {
  shopId: string | null;
  shopName: string | null;
  from: string;
  to: string;
  granularite: string;
  regroupement: string | null;
  periodes: { cle: string; label: string }[];
  groupes: string[];
  cellules: Record<string, Record<string, CelluleReleve>>;
  totauxParPeriode: Record<string, CelluleReleve>;
  totauxParGroupe: Record<string, CelluleReleve>;
  totalGeneral: CelluleReleve & { ventesCount: number };
  genereLe: string;
  codeCertification: string;
}

const GRANULARITES = [
  { valeur: "JOUR", cle: "rel_granulariteJour" },
  { valeur: "SEMAINE", cle: "rel_granulariteSemaine" },
  { valeur: "MOIS", cle: "rel_granulariteMois" },
  { valeur: "ANNEE", cle: "rel_granulariteAnnee" },
];

const REGROUPEMENTS = [
  { valeur: "", cle: "rel_regroupementAucun" },
  { valeur: "PRODUIT", cle: "rel_regroupementProduit" },
  { valeur: "CATEGORIE", cle: "rel_regroupementCategorie" },
  { valeur: "MOYEN_PAIEMENT", cle: "rel_regroupementMoyenPaiement" },
];

function formaterCellule(c: CelluleReleve): string {
  const parts: string[] = [];
  if (c.montantUSD) parts.push(`$${c.montantUSD.toFixed(2)}`);
  if (c.montantCDF) parts.push(`${Math.round(c.montantCDF).toLocaleString("fr-FR")} FC`);
  return parts.length ? parts.join(" + ") : "—";
}

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

function RelevesContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [from, setFrom] = useState(ilYA(30));
  const [to, setTo] = useState(ilYA(0));
  const [granularite, setGranularite] = useState("JOUR");
  const [regroupement, setRegroupement] = useState("");
  const [releve, setReleve] = useState<ReleveActivite | null>(null);
  const [chargement, setChargement] = useState(false);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function construireQuery() {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(new Date(to).getTime() + 86_400_000).toISOString(), // borne 'to' incluse
      granularite,
    });
    if (regroupement) params.set("regroupement", regroupement);
    return params;
  }

  async function genererApercu() {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    try {
      const data = await api.get<ReleveActivite>(
        `/shops/${currentShop.id}/reports/releve?${construireQuery().toString()}`,
      );
      setReleve(data);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rel_erreurGeneration"));
    } finally {
      setChargement(false);
    }
  }

  async function exporter(format: "xlsx" | "pdf") {
    if (!currentShop) return;
    setExportEnCours(format);
    setErreur(null);
    try {
      const query = construireQuery();
      query.set("format", format);
      const path = `/shops/${currentShop.id}/reports/releve?${query.toString()}`;
      if (format === "xlsx") {
        await telechargerFichier(path, "releve-activite-eleganz.xlsx");
      } else {
        await ouvrirDocumentPdf(path);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("fact_exportImpossible"));
    } finally {
      setExportEnCours(null);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_releves")}</h1>
      <p className={styles.sousTitre}>{t("rel_sousTitre")}</p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label htmlFor="from">{t("rel_du")}</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="to">{t("rel_au")}</label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="granularite">{t("rel_frequence")}</label>
          <select id="granularite" value={granularite} onChange={(e) => setGranularite(e.target.value)}>
            {GRANULARITES.map((g) => (
              <option key={g.valeur} value={g.valeur}>
                {t(g.cle)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="regroupement">{t("rel_regroupement")}</label>
          <select id="regroupement" value={regroupement} onChange={(e) => setRegroupement(e.target.value)}>
            {REGROUPEMENTS.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {t(r.cle)}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} onClick={genererApercu} disabled={chargement}>
          {chargement ? t("rel_generationEnCours") : t("rel_afficherApercu")}
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {releve && (
        <>
          <div className={styles.actionsExport}>
            <button className={styles.boutonSecondaire} onClick={() => exporter("xlsx")} disabled={exportEnCours !== null}>
              {exportEnCours === "xlsx" ? "…" : t("fact_exporterExcel")}
            </button>
            <button className={styles.boutonSecondaire} onClick={() => exporter("pdf")} disabled={exportEnCours !== null}>
              {exportEnCours === "pdf" ? "…" : t("rel_exporterPdf")}
            </button>
          </div>

          <div className={styles.tableauScroll}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{regroupement ? t(REGROUPEMENTS.find((r) => r.valeur === regroupement)?.cle ?? "rel_regroupementAucun") : t("panier_total")}</th>
                  {releve.periodes.map((p) => (
                    <th key={p.cle} className={styles.colChiffre}>
                      {p.label}
                    </th>
                  ))}
                  <th className={styles.colChiffre}>{t("panier_total")}</th>
                </tr>
              </thead>
              <tbody>
                {releve.groupes.map((groupe) => (
                  <tr key={groupe}>
                    <td>{groupe}</td>
                    {releve.periodes.map((p) => (
                      <td key={p.cle} className={styles.colChiffre}>
                        {formaterCellule(releve.cellules[groupe][p.cle])}
                      </td>
                    ))}
                    <td className={styles.colChiffre}>
                      <strong>{formaterCellule(releve.totauxParGroupe[groupe])}</strong>
                    </td>
                  </tr>
                ))}
                <tr className={styles.ligneTotal}>
                  <td>{t("rel_totalGeneral")}</td>
                  {releve.periodes.map((p) => (
                    <td key={p.cle} className={styles.colChiffre}>
                      {formaterCellule(releve.totauxParPeriode[p.cle])}
                    </td>
                  ))}
                  <td className={styles.colChiffre}>{formaterCellule(releve.totalGeneral)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.certification}>
            {t("rel_certifiePar")}{" "}
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(
              new Date(releve.genereLe),
            )}
            . {t("rel_codeVerification")} <strong>{releve.codeCertification}</strong> —{" "}
            {releve.totalGeneral.ventesCount} {t("rel_venteCommandeIncluse")}
          </p>
        </>
      )}
    </div>
  );
}

export default function RelevesPage() {
  return (
    <ProtectedGestionPage>
      <RelevesContent />
    </ProtectedGestionPage>
  );
}
