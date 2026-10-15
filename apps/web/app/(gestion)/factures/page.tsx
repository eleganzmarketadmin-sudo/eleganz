"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { useLocale } from "../../lib/i18n/LocaleContext";
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

const CLES_TYPE: Record<string, string> = {
  TICKET: "fact_typeTicket",
  RECEIPT: "fact_typeRecu",
  INVOICE_INTERNAL: "fact_typeFactureInterne",
  INVOICE_FISCAL: "fact_typeFactureFiscale",
  PROFORMA: "fact_typeProforma",
  QUOTE: "fact_typeDevis",
  CREDIT_NOTE: "fact_typeNoteCredit",
  DELIVERY_NOTE: "fact_typeBonLivraison",
};

const CLES_SOURCE: Record<string, string> = {
  CAISSE: "nav_caisse",
  MARKETPLACE: "nom_market",
  AUTRE: "fact_sourceAutre",
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
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique")))
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
      setErreur(err instanceof Error ? err.message : t("fact_erreurOuverture"));
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
      setErreur(err instanceof Error ? err.message : t("fact_exportImpossible"));
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_mesFactures")}</h1>
      <p className={styles.texteAide}>{t("fact_texteAide")}</p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <div className={styles.barreOutils}>
        <input
          className={styles.recherche}
          type="text"
          placeholder={t("fact_placeholderRecherche")}
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
              {f === "TOUS" ? t("fact_toutesOrigines") : t(CLES_SOURCE[f])}
            </button>
          ))}
        </div>
        <button className={styles.boutonSecondaire} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? "…" : t("fact_exporterExcel")}
        </button>
      </div>

      {totalParDevise.length > 0 && (
        <div className={styles.totaux}>
          {totalParDevise.map(([devise, montant]) => (
            <span key={devise}>
              {t("fact_totalAffiche")} <strong className="chiffre">{formatMoney(montant, devise)}</strong>
            </span>
          ))}
        </div>
      )}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : documentsVisibles.length === 0 ? (
        <p className={styles.messageVide}>
          {documents.length === 0 ? t("fact_aucuneVente") : t("fact_aucunResultatRecherche")}
        </p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("fact_colNum")}</th>
              <th>{t("fact_colType")}</th>
              <th>{t("fact_colOrigine")}</th>
              <th>{t("eq_colContact")}</th>
              <th className={styles.colChiffre}>{t("fact_colMontant")}</th>
              <th>{t("fact_colDate")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documentsVisibles.map((d) => (
              <tr key={d.id}>
                <td className={styles.colMono}>{d.number}</td>
                <td>{CLES_TYPE[d.type] ? t(CLES_TYPE[d.type]) : d.type}</td>
                <td>{t(CLES_SOURCE[d.source])}</td>
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
                    {impressionEnCours === d.id ? "…" : t("fact_reimprimer")}
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
