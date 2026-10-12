"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import styles from "./page.module.css";

interface DocumentVente {
  id: string;
  type: string;
  number: string;
  isFiscallyHomologated: boolean;
  createdAt: string;
  source: "CAISSE" | "MARKETPLACE" | "AUTRE";
  amount: number | null;
  currency: string | null;
  client: string | null;
}

const LABELS_TYPE: Record<string, string> = {
  TICKET: "Ticket de caisse",
  RECEIPT: "Reçu",
  INVOICE_INTERNAL: "Facture interne",
  INVOICE_FISCAL: "Facture fiscale",
  PROFORMA: "Facture proforma",
  QUOTE: "Devis",
  CREDIT_NOTE: "Note de crédit",
  DELIVERY_NOTE: "Bon de livraison",
};

const LABELS_SOURCE: Record<string, string> = {
  CAISSE: "Caisse",
  MARKETPLACE: "Marketplace",
  AUTRE: "Autre",
};

/**
 * "Mes factures" — suivi autonome des ventes de la boutique (prompt du 12
 * oct. 2026) : avant cet écran, une vente encaissée en caisse n'apparaissait
 * nulle part après son ticket initial — "Commandes" ne liste que les
 * commandes Marketplace, pas les ventes comptoir. Cette page réunit TOUT
 * document déjà émis, quelle que soit son origine, avec réimpression et
 * export Excel.
 */
function FacturesContent() {
  const { currentShop } = useShop();
  const [documents, setDocuments] = useState<DocumentVente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreSource, setFiltreSource] = useState<"TOUS" | "CAISSE" | "MARKETPLACE">("TOUS");
  const [impressionEnCours, setImpressionEnCours] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<DocumentVente[]>(`/shops/${currentShop.id}/documents`)
      .then(setDocuments)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop]);

  const documentsVisibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return documents.filter((d) => {
      if (filtreSource !== "TOUS" && d.source !== filtreSource) return false;
      if (!q) return true;
      return `${d.number} ${d.client ?? ""}`.toLowerCase().includes(q);
    });
  }, [documents, recherche, filtreSource]);

  const totalParDevise = useMemo(() => {
    const totaux = new Map<string, number>();
    for (const d of documentsVisibles) {
      if (d.amount == null || !d.currency) continue;
      totaux.set(d.currency, (totaux.get(d.currency) ?? 0) + d.amount);
    }
    return [...totaux.entries()];
  }, [documentsVisibles]);

  async function reimprimer(documentId: string) {
    if (!currentShop) return;
    setImpressionEnCours(documentId);
    setErreur(null);
    try {
      await ouvrirDocumentPdf(`/shops/${currentShop.id}/documents/${documentId}/pdf`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le document n'a pas pu être ouvert.");
    } finally {
      setImpressionEnCours(null);
    }
  }

  async function exporter() {
    if (!currentShop) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      await telechargerFichier(`/shops/${currentShop.id}/documents/export`, "mes-ventes-eleganz.xlsx");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Mes factures</h1>
      <p className={styles.texteAide}>
        Toutes les ventes de la boutique — comptoir et Marketplace — avec leurs documents, en un
        seul endroit, indépendamment de la gestion du catalogue ou des commandes en cours.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <div className={styles.barreOutils}>
        <input
          className={styles.recherche}
          type="text"
          placeholder="Chercher par n° de document ou client…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className={styles.filtres}>
          {(["TOUS", "CAISSE", "MARKETPLACE"] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filtreBouton} ${filtreSource === f ? styles.filtreBoutonActif : ""}`}
              onClick={() => setFiltreSource(f)}
            >
              {f === "TOUS" ? "Toutes origines" : LABELS_SOURCE[f]}
            </button>
          ))}
        </div>
        <button className={styles.boutonSecondaire} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? "…" : "Exporter en Excel"}
        </button>
      </div>

      {totalParDevise.length > 0 && (
        <div className={styles.totaux}>
          {totalParDevise.map(([devise, montant]) => (
            <span key={devise}>
              Total affiché : <strong className="chiffre">{formatMoney(montant, devise)}</strong>
            </span>
          ))}
        </div>
      )}

      {chargement ? (
        <p>Chargement…</p>
      ) : documentsVisibles.length === 0 ? (
        <p className={styles.messageVide}>
          {documents.length === 0
            ? "Aucune vente enregistrée pour l'instant. Vos tickets de caisse et vos commandes Marketplace apparaîtront ici."
            : "Aucun document ne correspond à cette recherche."}
        </p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>N°</th>
              <th>Type</th>
              <th>Origine</th>
              <th>Client</th>
              <th className={styles.colChiffre}>Montant</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documentsVisibles.map((d) => (
              <tr key={d.id}>
                <td className={styles.colMono}>{d.number}</td>
                <td>{LABELS_TYPE[d.type] ?? d.type}</td>
                <td>{LABELS_SOURCE[d.source]}</td>
                <td>{d.client ?? "—"}</td>
                <td className={styles.colChiffre}>
                  {d.amount != null && d.currency ? formatMoney(d.amount, d.currency) : "—"}
                </td>
                <td>{formatDate(d.createdAt)}</td>
                <td>
                  <button
                    className={styles.boutonReimprimer}
                    onClick={() => reimprimer(d.id)}
                    disabled={impressionEnCours === d.id}
                  >
                    {impressionEnCours === d.id ? "…" : "Réimprimer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function FacturesPage() {
  return (
    <ProtectedGestionPage>
      <FacturesContent />
    </ProtectedGestionPage>
  );
}
