"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Stock & CMV (14 oct. 2026, chantier SYSCOHADA phase 4) — seul écran qui
// permet de saisir une réception valorisée (quantité + coût unitaire),
// seul point d'entrée qui fait progresser le CUMP d'une variante. Tant
// qu'aucune réception n'a eu lieu pour une variante, son CUMP reste
// inconnu (affiché "—"), exactement comme avant ce chantier.
interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockQty: number;
  coutMoyenPondere: string | null;
}

interface Product {
  id: string;
  name: string;
  variants: Variant[];
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
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
      setErreur(err instanceof ApiError ? err.message : "Erreur lors de la réception.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "20px" }}>
        Chaque réception (quantité + coût unitaire réel) fait progresser le
        coût unitaire moyen pondéré (CUMP) de la variante. Tant qu&apos;aucune
        réception n&apos;a été saisie, le CUMP reste inconnu (&laquo;&nbsp;—&nbsp;&raquo;) et la
        sortie correspondante n&apos;est pas valorisée en comptabilité.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Chargement…</p>
      ) : (
        <table className={styles.tableau} style={{ marginBottom: "28px" }}>
          <thead>
            <tr>
              <th>Article</th>
              <th>Variante</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th style={{ textAlign: "right" }}>CUMP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produits.flatMap((p) =>
              p.variants.map((v) => (
                <tr key={v.id}>
                  <td>{p.name}</td>
                  <td>
                    {v.sku} {v.size ? `· ${v.size}` : ""} {v.color ? `· ${v.color}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>{v.stockQty}</td>
                  <td style={{ textAlign: "right" }}>{v.coutMoyenPondere ? `${f(v.coutMoyenPondere)} $` : "—"}</td>
                  <td>
                    <button onClick={() => ouvrirVariante(v.id)}>Réceptionner</button>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}

      {varianteOuverte && (
        <div style={{ border: "1px solid var(--color-bordure, #333)", borderRadius: "8px", padding: "16px" }}>
          <strong>Nouvelle réception</strong>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "10px" }}>
            <div className={styles.champ}>
              <label>Quantité</label>
              <input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>Coût unitaire ($)</label>
              <input type="number" min="0" step="0.01" value={coutUnitaire} onChange={(e) => setCoutUnitaire(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>Fournisseur (optionnel)</label>
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
              À crédit
            </label>
            <button onClick={enregistrerReception} disabled={enCours || !quantite || !coutUnitaire}>
              Enregistrer la réception
            </button>
            <button onClick={() => setVarianteOuverte(null)}>Fermer</button>
          </div>

          <h4 style={{ marginTop: "20px" }}>Historique des réceptions</h4>
          {historique.length === 0 ? (
            <p style={{ color: "#888", fontSize: "0.875rem" }}>Aucune réception encore saisie pour cette variante.</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Quantité</th>
                  <th style={{ textAlign: "right" }}>Coût unitaire</th>
                  <th>Crédit</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td style={{ textAlign: "right" }}>{r.quantity}</td>
                    <td style={{ textAlign: "right" }}>{f(r.coutUnitaire)} $</td>
                    <td>{r.onCredit ? "Oui" : "Non"}</td>
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
