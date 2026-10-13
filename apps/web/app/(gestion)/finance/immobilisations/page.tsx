"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Immobilisations et amortissements (13 oct. 2026, Finance & Comptabilité
// Phase 4) — voir docs/ARCHITECTURE_FINANCE.md §8quater. Amortissement
// linéaire uniquement. La comptabilisation d'un mois est une action
// explicite (bouton ci-dessous), jamais automatique : aucun scheduler
// serveur ne tourne en tâche de fond à cette phase.
interface Depreciation {
  id: string;
  periodDate: string;
  amount: string;
}

interface Asset {
  id: string;
  label: string;
  acquisitionDate: string;
  acquisitionCost: string;
  durationMonths: number;
  disposed: boolean;
  depreciations: Depreciation[];
}

interface ResultatDotation {
  assetId: string;
  label: string;
  montant: number;
  statut: "comptabilise" | "deja_comptabilise" | "termine";
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cumulAmorti(actif: Asset): number {
  return actif.depreciations.reduce((s, d) => s + Number(d.amount), 0);
}

function AmortissementsContenu() {
  const { currentShop } = useShop();
  const [actifs, setActifs] = useState<Asset[] | null>(null);
  const [label, setLabel] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [durationMonths, setDurationMonths] = useState("36");
  const [periode, setPeriode] = useState(moisCourant());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [resultatsDotation, setResultatsDotation] = useState<ResultatDotation[] | null>(null);

  const recharger = () => {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Asset[]>(`/shops/${currentShop.id}/assets`)
      .then(setActifs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  };

  useEffect(recharger, [currentShop]);

  const creerActif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/assets`, {
        label,
        acquisitionDate,
        acquisitionCost: Number(acquisitionCost),
        durationMonths: Number(durationMonths),
      });
      setLabel("");
      setAcquisitionCost("");
      setConfirmation("Immobilisation enregistrée.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  const miseAuRebut = async (assetId: string) => {
    if (!currentShop) return;
    await api.post(`/shops/${currentShop.id}/assets/${assetId}/mise-au-rebut`, {});
    recharger();
  };

  const comptabiliserDotations = async () => {
    if (!currentShop) return;
    setErreur(null);
    setResultatsDotation(null);
    try {
      const resultats = await api.post<ResultatDotation[]>(
        `/shops/${currentShop.id}/assets/depreciation/run?period=${periode}`,
        {},
      );
      setResultatsDotation(resultats);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Erreur.");
    }
  };

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Immobilisations de la boutique et amortissement linéaire sur la durée
        saisie. La dotation d&apos;un mois n&apos;est jamais comptabilisée
        automatiquement : cliquez sur « Comptabiliser les dotations » pour le
        mois choisi — l&apos;écriture (compte 681 débité / compte 2841
        crédité) apparaît ensuite dans l&apos;onglet Comptabilité.
      </p>

      <h2>Nouvelle immobilisation</h2>
      <form onSubmit={creerActif} className={styles.formulaire}>
        <div className={styles.champ}>
          <label>Libellé</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Ordinateur comptoir" required />
        </div>
        <div className={styles.champ}>
          <label>Date d&apos;acquisition</label>
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} required />
        </div>
        <div className={styles.champ}>
          <label>Coût (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            required
          />
        </div>
        <div className={styles.champ}>
          <label>Durée d&apos;amortissement (mois)</label>
          <input
            type="number"
            min="1"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.bouton}>
          Enregistrer l&apos;immobilisation
        </button>
      </form>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", margin: "24px 0" }}>
        <div className={styles.champ}>
          <label>Comptabiliser les dotations du mois</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} />
        </div>
        <button type="button" className={styles.bouton} onClick={comptabiliserDotations}>
          Comptabiliser les dotations
        </button>
      </div>

      {resultatsDotation && (
        <ul style={{ marginBottom: "20px" }}>
          {resultatsDotation.map((r) => (
            <li key={r.assetId}>
              {r.label} :{" "}
              {r.statut === "comptabilise"
                ? `dotation de ${f(r.montant)} $ comptabilisée.`
                : r.statut === "deja_comptabilise"
                ? "déjà comptabilisée pour ce mois."
                : "durée d'amortissement déjà écoulée."}
            </li>
          ))}
        </ul>
      )}

      {chargement ? (
        <p>Chargement…</p>
      ) : !actifs || actifs.length === 0 ? (
        <p>Aucune immobilisation enregistrée.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Acquisition</th>
              <th style={{ textAlign: "right" }}>Coût</th>
              <th>Durée</th>
              <th style={{ textAlign: "right" }}>Amorti à ce jour</th>
              <th style={{ textAlign: "right" }}>Valeur nette</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((a) => {
              const amorti = cumulAmorti(a);
              const valeurNette = Number(a.acquisitionCost) - amorti;
              return (
                <tr key={a.id} style={{ opacity: a.disposed ? 0.5 : 1 }}>
                  <td>
                    {a.label}
                    {a.disposed ? " (mis au rebut)" : ""}
                  </td>
                  <td>{new Date(a.acquisitionDate).toLocaleDateString("fr-FR")}</td>
                  <td style={{ textAlign: "right" }}>{f(a.acquisitionCost)} $</td>
                  <td>{a.durationMonths} mois</td>
                  <td style={{ textAlign: "right" }}>{f(amorti)} $</td>
                  <td style={{ textAlign: "right" }}>{f(valeurNette)} $</td>
                  <td>
                    {!a.disposed && (
                      <button type="button" className={styles.retirer} onClick={() => miseAuRebut(a.id)}>
                        Mettre au rebut
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ImmobilisationsPage() {
  return (
    <ProtectedGestionPage>
      <AmortissementsContenu />
    </ProtectedGestionPage>
  );
}
