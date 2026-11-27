"use client";

import { useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Statistiques — classement des meilleures ventes (27 nov. 2026, demande :
// "Dans gestion sur Ajouter un classement des produits de la boutique les
// plus vendus quantité et valeur" — réponses validées : export gated comme
// Factures/Relevés, périmètre Marketplace + Caisse combinées, nouvelle page
// dédiée). Réutilise tel quel le moteur de relevé existant
// (ReportsService.genererReleve avec regroupement=PRODUIT, déjà déployé et
// déjà correctement gardé pour l'export) — `totauxParGroupe` combine déjà
// les ventes caisse (PosSale) et Marketplace (ShopOrder), aucun nouveau
// calcul côté API n'était nécessaire pour cet écran.
interface Cellule {
  montantUSD: number;
  montantCDF: number;
  quantite: number;
}

interface ReleveActivite {
  groupes: string[];
  totauxParGroupe: Record<string, Cellule>;
  totalGeneral: Cellule & { ventesCount: number };
}

type Tri = "quantite" | "valeur";

function f(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function formaterMontants(c: Cellule): string {
  const parts: string[] = [];
  if (c.montantUSD) parts.push(`$${c.montantUSD.toFixed(2)}`);
  if (c.montantCDF) parts.push(`${Math.round(c.montantCDF).toLocaleString("fr-FR")} FC`);
  return parts.length ? parts.join(" + ") : "—";
}

// Valeur commune (USD) utilisée seulement pour trier la colonne "valeur" —
// un panier mixte USD/CDF pourrait fausser un tri au change courant, donc
// on trie sur montantUSD seul (dominant dans ce commerce) ; l'affichage
// garde les deux devises séparées, inchangé.
function valeurTri(c: Cellule): number {
  return c.montantUSD + c.montantCDF;
}

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

function StatistiquesContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [from, setFrom] = useState(ilYA(30));
  const [to, setTo] = useState(ilYA(0));
  const [releve, setReleve] = useState<ReleveActivite | null>(null);
  const [chargement, setChargement] = useState(false);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>("quantite");
  const [ordreDesc, setOrdreDesc] = useState(true);

  function construireQuery() {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(new Date(to).getTime() + 86_400_000).toISOString(), // borne 'to' incluse
      granularite: "MOIS",
      regroupement: "PRODUIT",
    });
    return params;
  }

  async function genererClassement() {
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
        await telechargerFichier(path, "statistiques-eleganz.xlsx");
      } else {
        await ouvrirDocumentPdf(path);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("fact_exportImpossible"));
    } finally {
      setExportEnCours(null);
    }
  }

  function basculerTri(colonne: Tri) {
    if (tri === colonne) {
      setOrdreDesc((d) => !d);
    } else {
      setTri(colonne);
      setOrdreDesc(true);
    }
  }

  const classement = useMemo(() => {
    if (!releve) return [];
    const lignes = releve.groupes.map((g) => ({ produit: g, cellule: releve.totauxParGroupe[g] }));
    lignes.sort((a, b) => {
      const va = tri === "quantite" ? a.cellule.quantite : valeurTri(a.cellule);
      const vb = tri === "quantite" ? b.cellule.quantite : valeurTri(b.cellule);
      return ordreDesc ? vb - va : va - vb;
    });
    return lignes;
  }, [releve, tri, ordreDesc]);

  function flecheTri(colonne: Tri): string {
    if (tri !== colonne) return "⇅";
    return ordreDesc ? "▼" : "▲";
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("stat_titre")}</h1>
      <p className={styles.sousTitre}>{t("stat_sousTitre")}</p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label htmlFor="from">{t("rel_du")}</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="to">{t("rel_au")}</label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className={styles.bouton} onClick={genererClassement} disabled={chargement}>
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

          {classement.length === 0 ? (
            <p>{t("stat_aucuneVente")}</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th></th>
                    <th>{t("stat_colProduit")}</th>
                    <th className={`${styles.colChiffre} ${styles.triable}`} onClick={() => basculerTri("quantite")}>
                      {t("stat_colQuantite")} {flecheTri("quantite")}
                    </th>
                    <th className={`${styles.colChiffre} ${styles.triable}`} onClick={() => basculerTri("valeur")}>
                      {t("stat_colValeur")} {flecheTri("valeur")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classement.map((l, i) => (
                    <tr key={l.produit}>
                      <td className={styles.rang}>{i + 1}</td>
                      <td>{l.produit}</td>
                      <td className={styles.colChiffre}>{f(l.cellule.quantite)}</td>
                      <td className={styles.colChiffre}>{formaterMontants(l.cellule)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StatistiquesPage() {
  return (
    <ProtectedGestionPage>
      <StatistiquesContenu />
    </ProtectedGestionPage>
  );
}
