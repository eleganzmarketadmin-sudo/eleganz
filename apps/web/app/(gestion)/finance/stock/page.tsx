"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { telechargerFichier } from "../../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Stock & CMV (14 oct. 2026, chantier SYSCOHADA phase 4) — seul écran qui
// permet de saisir une réception valorisée (quantité + coût unitaire),
// seul point d'entrée qui fait progresser le CUMP d'une variante. Tant
// qu'aucune réception n'a eu lieu pour une variante, son CUMP reste
// inconnu (affiché "—"), exactement comme avant ce chantier.
//
// Tri, export et alerte de stock bas ajoutés le 27 nov. 2026 (demande :
// "rajouter les boutons pour filtrer les quantités par article croissant
// ou décroissant ... exporter en Excel ou pdf ... menu ou option d'alerte
// sur les articles et leurs quantité pour organiser un approvisionnement").
interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockQty: number;
  coutMoyenPondere: string | null;
  lowStockAt: number;
}

interface Product {
  id: string;
  name: string;
  variants: Variant[];
}

interface LigneStock {
  produitId: string;
  produitNom: string;
  variante: Variant;
}

interface Supplier {
  id: string;
  name: string;
}

interface Reception {
  id: string;
  quantity: number;
  coutUnitaire: string;
  onCredit: boolean;
  createdAt: string;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function StockContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [produits, setProduits] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [varianteOuverte, setVarianteOuverte] = useState<string | null>(null);
  const [historique, setHistorique] = useState<Reception[]>([]);
  const [quantite, setQuantite] = useState("");
  const [coutUnitaire, setCoutUnitaire] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [onCredit, setOnCredit] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const [triStock, setTriStock] = useState<"asc" | "desc" | null>(null);
  const [stockBasUniquement, setStockBasUniquement] = useState(false);
  const [seuilEnEdition, setSeuilEnEdition] = useState<Record<string, string>>({});
  const [seuilEnCours, setSeuilEnCours] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    Promise.all([
      api.get<Product[]>(`/shops/${currentShop.id}/products`),
      api.get<Supplier[]>(`/shops/${currentShop.id}/suppliers`),
    ])
      .then(([p, s]) => {
        setProduits(p);
        setSuppliers(s);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop]);

  function ouvrirVariante(variantId: string) {
    if (!currentShop) return;
    setVarianteOuverte(variantId);
    setQuantite("");
    setCoutUnitaire("");
    setSupplierId("");
    setOnCredit(false);
    api
      .get<Reception[]>(`/shops/${currentShop.id}/stock/variantes/${variantId}/receptions`)
      .then(setHistorique)
      .catch(() => setHistorique([]));
  }

  async function enregistrerReception() {
    if (!currentShop || !varianteOuverte) return;
    const qte = Number(quantite);
    const cout = Number(coutUnitaire);
    if (!qte || qte <= 0 || cout < 0) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/stock/receptions`, {
        variantId: varianteOuverte,
        quantity: qte,
        coutUnitaire: cout,
        supplierId: supplierId || undefined,
        onCredit,
      });
      recharger();
      ouvrirVariante(varianteOuverte);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("sto_erreurReception"));
    } finally {
      setEnCours(false);
    }
  }

  // Lignes aplaties (une par variante), filtrées sur le stock bas si demandé,
  // puis triées sur la quantité en stock selon `triStock` — le tableau par
  // défaut garde l'ordre d'arrivée de l'API (produit le plus récent d'abord),
  // `triStock` ne s'applique que si l'utilisateur clique l'en-tête "Stock".
  const toutesLesLignes: LigneStock[] = useMemo(
    () =>
      produits.flatMap((p) =>
        p.variants.map((v) => ({ produitId: p.id, produitNom: p.name, variante: v })),
      ),
    [produits],
  );

  const lignesStockBas = toutesLesLignes.filter((l) => l.variante.stockQty <= l.variante.lowStockAt);

  const lignes = useMemo(() => {
    const base = stockBasUniquement ? lignesStockBas : toutesLesLignes;
    if (!triStock) return base;
    const triees = [...base].sort((a, b) => a.variante.stockQty - b.variante.stockQty);
    return triStock === "asc" ? triees : triees.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toutesLesLignes, stockBasUniquement, triStock]);

  function basculerTriStock() {
    setTriStock((t) => (t === "asc" ? "desc" : t === "desc" ? null : "asc"));
  }

  async function enregistrerSeuil(produitId: string, variantId: string) {
    if (!currentShop) return;
    const valeur = Number(seuilEnEdition[variantId]);
    if (!Number.isFinite(valeur) || valeur < 0) return;
    setSeuilEnCours(variantId);
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produitId}/variants/${variantId}`, {
        lowStockAt: Math.round(valeur),
      });
      setSeuilEnEdition((prev) => {
        const { [variantId]: _retire, ...reste } = prev;
        return reste;
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    } finally {
      setSeuilEnCours(null);
    }
  }

  async function exporter(format: "xlsx" | "pdf") {
    if (!currentShop) return;
    setExportEnCours(format);
    setErreur(null);
    try {
      const path = `/shops/${currentShop.id}/stock/export?format=${format}`;
      if (format === "xlsx") {
        await telechargerFichier(path, "stock-eleganz.xlsx");
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
      <h1 className={styles.titre}>{t("fin_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "20px" }}>
        {t("sto_noteAide")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input
            type="checkbox"
            checked={stockBasUniquement}
            onChange={(e) => setStockBasUniquement(e.target.checked)}
          />
          {t("sto_stockBasUniquement")}
        </label>
        {lignesStockBas.length > 0 && (
          <span
            style={{
              background: "var(--color-flamme, #c0392b)",
              color: "#fff",
              borderRadius: "999px",
              padding: "2px 10px",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            {t("sto_articlesStockBas").replace("{{n}}", String(lignesStockBas.length))}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button onClick={() => exporter("xlsx")} disabled={exportEnCours !== null}>
            {exportEnCours === "xlsx" ? "…" : t("fact_exporterExcel")}
          </button>
          <button onClick={() => exporter("pdf")} disabled={exportEnCours !== null}>
            {exportEnCours === "pdf" ? "…" : t("rel_exporterPdf")}
          </button>
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : (
        <table className={styles.tableau} style={{ marginBottom: "28px" }}>
          <thead>
            <tr>
              <th>{t("sto_colArticle")}</th>
              <th>{t("sto_colVariante")}</th>
              <th style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }} onClick={basculerTriStock}>
                {t("cat_colStock")} {triStock === "asc" ? "▲" : triStock === "desc" ? "▼" : "⇅"}
              </th>
              <th style={{ textAlign: "right" }}>{t("sto_colCump")}</th>
              <th style={{ textAlign: "right" }}>{t("sto_colValeurStock")}</th>
              <th style={{ textAlign: "right" }}>{t("sto_seuilAlerte")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ produitId, produitNom, variante: v }) => {
              const enAlerte = v.stockQty <= v.lowStockAt;
              const valeurStock = v.coutMoyenPondere ? v.stockQty * Number(v.coutMoyenPondere) : 0;
              const seuilBrouillon = seuilEnEdition[v.id];
              return (
                <tr key={v.id} style={enAlerte ? { background: "rgba(192, 57, 43, 0.08)" } : undefined}>
                  <td>{produitNom}</td>
                  <td>
                    {v.sku} {v.size ? `· ${v.size}` : ""} {v.color ? `· ${v.color}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>{v.stockQty}</td>
                  <td style={{ textAlign: "right" }}>{v.coutMoyenPondere ? `${f(v.coutMoyenPondere)} $` : "—"}</td>
                  <td style={{ textAlign: "right" }}>{valeurStock ? `${f(valeurStock)} $` : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                      <input
                        type="number"
                        min="0"
                        style={{ width: "60px", textAlign: "right" }}
                        value={seuilBrouillon ?? String(v.lowStockAt)}
                        onChange={(e) =>
                          setSeuilEnEdition((prev) => ({ ...prev, [v.id]: e.target.value }))
                        }
                      />
                      {seuilBrouillon !== undefined && seuilBrouillon !== String(v.lowStockAt) && (
                        <button
                          onClick={() => enregistrerSeuil(produitId, v.id)}
                          disabled={seuilEnCours === v.id}
                        >
                          {seuilEnCours === v.id ? "…" : t("action_enregistrer")}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <button onClick={() => ouvrirVariante(v.id)}>{t("sto_receptionner")}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {varianteOuverte && (
        <div style={{ border: "1px solid var(--color-bordure, #333)", borderRadius: "8px", padding: "16px" }}>
          <strong>{t("sto_nouvelleReception")}</strong>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "10px" }}>
            <div className={styles.champ}>
              <label>{t("sto_quantite")}</label>
              <input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("sto_coutUnitaire")}</label>
              <input type="number" min="0" step="0.01" value={coutUnitaire} onChange={(e) => setCoutUnitaire(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("sto_fournisseurOptionnel")}</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={onCredit} onChange={(e) => setOnCredit(e.target.checked)} />
              {t("sto_aCredit")}
            </label>
            <button onClick={enregistrerReception} disabled={enCours || !quantite || !coutUnitaire}>
              {t("sto_enregistrerReception")}
            </button>
            <button onClick={() => setVarianteOuverte(null)}>{t("action_fermer")}</button>
          </div>

          <h4 style={{ marginTop: "20px" }}>{t("sto_historiqueReceptions")}</h4>
          {historique.length === 0 ? (
            <p style={{ color: "#888", fontSize: "0.875rem" }}>{t("sto_aucuneReception")}</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{t("cha_colDate")}</th>
                  <th style={{ textAlign: "right" }}>{t("sto_quantite")}</th>
                  <th style={{ textAlign: "right" }}>{t("sto_coutUnitaireCourt")}</th>
                  <th>{t("sto_colCredit")}</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td style={{ textAlign: "right" }}>{r.quantity}</td>
                    <td style={{ textAlign: "right" }}>{f(r.coutUnitaire)} $</td>
                    <td>{r.onCredit ? t("commun_oui") : t("commun_non")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <ProtectedGestionPage>
      <StockContenu />
    </ProtectedGestionPage>
  );
}
