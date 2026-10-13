"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Analytique et prévisions (13 oct. 2026, Finance & Comptabilité Phase 8)
// — voir docs/ARCHITECTURE_FINANCE.md §8octies. Évolution mensuelle réelle
// (compte de résultat recalculé mois par mois) + une projection simple
// (moyenne mobile des 3 derniers mois COMPLETS, jamais le mois courant qui
// est partiel) pour le mois suivant — toujours étiquetée comme estimation,
// jamais confondue avec une donnée réelle.
interface MoisAnalytique {
  mois: string;
  chiffreAffaires: number;
  charges: number;
  resultatNet: number;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function moyenneMobile(serie: MoisAnalytique[]): number | null {
  // Exclut le dernier mois (le mois courant, par définition partiel) et
  // prend la moyenne des 3 mois complets précédents, s'ils existent.
  const moisComplets = serie.slice(0, -1);
  const fenetre = moisComplets.slice(-3);
  if (fenetre.length === 0) return null;
  return fenetre.reduce((s, m) => s + m.chiffreAffaires, 0) / fenetre.length;
}

function Barre({ valeur, max }: { valeur: number; max: number }) {
  const largeur = max > 0 ? Math.max((Math.abs(valeur) / max) * 100, valeur !== 0 ? 2 : 0) : 0;
  return (
    <div style={{ background: "var(--color-border)", height: "10px", width: "100%" }}>
      <div
        style={{
          background: valeur >= 0 ? "var(--color-vert-paiement)" : "var(--color-flamme)",
          height: "100%",
          width: `${largeur}%`,
        }}
      />
    </div>
  );
}

function AnalytiqueContenu() {
  const { currentShop } = useShop();
  const [serie, setSerie] = useState<MoisAnalytique[] | null>(null);
  const [nombreMois, setNombreMois] = useState(6);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    api
      .get<MoisAnalytique[]>(`/shops/${currentShop.id}/finance/analytique?mois=${nombreMois}`)
      .then(setSerie)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop, nombreMois]);

  const projection = serie ? moyenneMobile(serie) : null;
  const maxCa = serie ? Math.max(...serie.map((m) => m.chiffreAffaires), projection ?? 0, 1) : 1;

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Évolution mensuelle réelle du chiffre d&apos;affaires, des charges
        et du résultat net, recalculée à partir des mêmes écritures que le
        compte de résultat. La projection du mois suivant est une simple
        moyenne mobile des 3 derniers mois complets — une estimation, pas
        une prévision garantie.
      </p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label>Nombre de mois</label>
          <select value={nombreMois} onChange={(e) => setNombreMois(Number(e.target.value))}>
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Chargement…</p>
      ) : !serie || serie.length === 0 ? (
        <p>Aucune donnée.</p>
      ) : (
        <>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>Mois</th>
                <th style={{ textAlign: "right" }}>Chiffre d&apos;affaires</th>
                <th></th>
                <th style={{ textAlign: "right" }}>Charges</th>
                <th style={{ textAlign: "right" }}>Résultat net</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((m, i) => (
                <tr key={m.mois}>
                  <td>
                    {m.mois}
                    {i === serie.length - 1 ? " (en cours, partiel)" : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>{f(m.chiffreAffaires)} $</td>
                  <td style={{ width: "160px" }}>
                    <Barre valeur={m.chiffreAffaires} max={maxCa} />
                  </td>
                  <td style={{ textAlign: "right" }}>{f(m.charges)} $</td>
                  <td style={{ textAlign: "right" }}>{f(m.resultatNet)} $</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: "16px" }}>
            {projection === null
              ? "Pas assez de mois complets pour une projection."
              : `Projection (estimation, moyenne mobile) du chiffre d'affaires du mois suivant : ${f(projection)} $`}
          </p>
        </>
      )}
    </div>
  );
}

export default function AnalytiquePage() {
  return (
    <ProtectedGestionPage>
      <AnalytiqueContenu />
    </ProtectedGestionPage>
  );
}
