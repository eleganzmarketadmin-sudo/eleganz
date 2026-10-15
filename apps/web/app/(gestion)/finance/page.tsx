"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../components/FinanceSubNav";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

// Tableau de bord financier (prompt du 13 oct. 2026, §7) — chaque chiffre
// est une ESTIMATION à partir des opérations réellement enregistrées
// (caisse, Marketplace, achats, charges), jamais un résultat certifié ni
// audité. Voir docs/ARCHITECTURE_FINANCE.md §4 pour ce qui est délibérément
// absent à cette phase (comptabilité en partie double, états financiers
// réglementaires, clôture).
interface Dashboard {
  periode: { from: string; to: string };
  chiffreAffaires: { total: number; boutique: number; marketplace: number };
  encaissementsConfirmes: number;
  achats: number;
  charges: { total: number; parDevise: Record<string, number> };
  amortissements: number;
  margeBrute: number | null;
  margeFiable: boolean;
  resultatEstime: number;
  dettesFournisseurs: number;
  creditClientAccorde: number;
  creancesMarketplace411: number;
  commissionMarketplace: number;
  statut: { resultat: string; commission: string; dettesFournisseurs: string; creancesMarketplace411: string };
}

function formatMontant(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function FinanceDashboardContent() {
  const { currentShop } = useShop();
  const [data, setData] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Dashboard>(`/shops/${currentShop.id}/finance/dashboard`)
      .then(setData)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop]);

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "20px" }}>
        Mois en cours — chiffres calculés à partir des opérations déjà
        enregistrées (caisse, commandes Marketplace, achats, charges).
        Ce sont des estimations de pilotage, pas des états financiers
        certifiés.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Calcul en cours…</p>
      ) : !data ? (
        <p>Aucune donnée.</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <Carte titre="Chiffre d'affaires" valeur={`${formatMontant(data.chiffreAffaires.total)} $`}
              detail={`Caisse ${formatMontant(data.chiffreAffaires.boutique)} $ · Marketplace ${formatMontant(data.chiffreAffaires.marketplace)} $`} />
            <Carte titre="Encaissements confirmés" valeur={`${formatMontant(data.encaissementsConfirmes)} $`} />
            <Carte titre="Achats" valeur={`${formatMontant(data.achats)} $`} />
            <Carte titre="Charges" valeur={`${formatMontant(data.charges.total)} $`} />
            <Carte titre="Amortissements" valeur={`${formatMontant(data.amortissements)} $`} detail="Dotations aux amortissements comptabilisées sur la période (compte 681)." />
            <Carte
              titre="Marge brute"
              valeur={data.margeFiable && data.margeBrute != null ? `${formatMontant(data.margeBrute)} $` : "—"}
              detail={data.margeFiable ? undefined : "Coût moyen pondéré (CUMP) inconnu pour au moins un article vendu, ou vente rapide sans article catalogué."}
            />
            <Carte titre="Résultat estimé" valeur={`${formatMontant(data.resultatEstime)} $`} detail={data.statut.resultat} />
            <Carte titre="Dettes fournisseurs" valeur={`${formatMontant(data.dettesFournisseurs)} $`} detail={data.statut.dettesFournisseurs} />
            <Carte titre="Crédit client accordé" valeur={`${formatMontant(data.creditClientAccorde)} $`} detail="Ventes à crédit accordées aux clients — distinct de la créance Marketplace ci-dessous." />
            <Carte titre="Créances Marketplace (411)" valeur={`${formatMontant(data.creancesMarketplace411)} $`} detail={data.statut.creancesMarketplace411} />
            <Carte titre="Commission Marketplace" valeur={`${formatMontant(data.commissionMarketplace)} $`} detail={data.statut.commission} />
          </div>
        </>
      )}

      <div style={{ border: "1px dashed var(--color-bordure, #333)", borderRadius: "8px", padding: "14px 16px", marginTop: "12px" }}>
        <strong style={{ fontSize: "0.9rem" }}>Besoin d&apos;un carnet personnel, sans boutique ?</strong>
        <p style={{ marginTop: "6px", fontSize: "0.85rem", color: "#888" }}>
          Finance &amp; Comptabilité est toujours lié à cette boutique. Pour un
          suivi indépendant (vos propres ventes, dépenses, dettes et créances,
          sans créer de boutique), utilisez{" "}
          <a href="/comptable" target="_blank" rel="noreferrer">
            ELEGANZ Secourable
          </a>{" "}
          — un carnet séparé, pas un substitut à cet écran.
        </p>
      </div>
    </div>
  );
}

function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <div style={{ border: "1px solid var(--color-bordure, #333)", borderRadius: "8px", padding: "16px" }}>
      <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "6px" }}>{titre}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{valeur}</div>
      {detail && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "6px" }}>{detail}</div>}
    </div>
  );
}

export default function FinancePage() {
  return (
    <ProtectedGestionPage>
      <FinanceDashboardContent />
    </ProtectedGestionPage>
  );
}
