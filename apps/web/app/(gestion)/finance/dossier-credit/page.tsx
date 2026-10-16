"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Dossier de crédit boutique (demande du 16 oct. 2026, point 1) — pendant,
// côté Gestion, du "Dossier de financement" d'ELEGANZ Mon assistant
// (/comptable/dossier-financement), mais assemblé à partir des écritures
// comptables réelles de la boutique (GET/export /shops/:shopId/finance/
// dossier-credit, voir finance.service.ts::dossierCredit) plutôt que d'une
// saisie déclarative. Regroupe aussi un accès rapide aux états financiers
// déjà existants et un simulateur de remboursement — tout ce qu'il faut
// réunir pour une demande de crédit auprès d'une institution financière.
function DossierCreditContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [montant, setMontant] = useState("");
  const [tauxAnnuel, setTauxAnnuel] = useState("");
  const [dureeMois, setDureeMois] = useState("");

  async function telecharger() {
    if (!currentShop) return;
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrirDocumentPdf(`/shops/${currentShop.id}/finance/export/dossier-credit?mois=12`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("credit_erreurGeneration"));
    } finally {
      setEnCours(false);
    }
  }

  // Simulation de remboursement (amortissement à mensualité constante) —
  // purement indicative, calculée côté client, jamais une offre de crédit
  // réelle : chaque institution applique ses propres frais et conditions.
  const p = Number(montant);
  const n = Number(dureeMois);
  const r = Number(tauxAnnuel) / 100 / 12;
  const simulationValide = p > 0 && n > 0 && r > 0;
  const mensualite = simulationValide ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : null;
  const coutTotal = mensualite !== null ? mensualite * n : null;
  const totalInterets = coutTotal !== null ? coutTotal - p : null;

  return (
    <div>
      <h1 className={styles.titre}>{t("credit_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-4)" }}>
        {t("credit_sousTitre")}
      </p>

      <div style={{ background: "#fff3cd", color: "#664d03", padding: "var(--espace-4)", marginBottom: "var(--espace-5)", fontWeight: 600, fontSize: "0.875rem" }}>
        {t("credit_avertissement")}
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("dossier_contenuTitre")}</h2>
        <ul style={{ paddingLeft: "var(--espace-4)", marginBottom: "var(--espace-4)" }}>
          <li>{t("credit_listeHistorique")}</li>
          <li>{t("credit_listeBilan")}</li>
          <li>{t("credit_listeDettesCreances")}</li>
          <li>{t("dossier_codeVerification")}</li>
        </ul>

        {erreur && <div className={styles.erreur}>{erreur}</div>}

        <button className={styles.bouton} onClick={telecharger} disabled={enCours || !currentShop}>
          {enCours ? t("dossier_genererEnCours") : t("dossier_telechargerPdf")}
        </button>
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("credit_etatsFinanciersTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
          {t("credit_etatsFinanciersDescription")}
        </p>
        <Link href="/finance/comptabilite" style={{ textDecoration: "underline" }}>
          {t("credit_voirEtatsFinanciers")}
        </Link>
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)" }}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("credit_simulateurTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
          {t("credit_simulateurDescription")}
        </p>
        <div className={styles.formulaire} style={{ marginBottom: "var(--espace-4)" }}>
          <div className={styles.champ}>
            <label>{t("credit_labelMontant")}</label>
            <input type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <div className={styles.champ}>
            <label>{t("credit_labelTaux")}</label>
            <input type="number" min="0" step="0.1" value={tauxAnnuel} onChange={(e) => setTauxAnnuel(e.target.value)} />
          </div>
          <div className={styles.champ}>
            <label>{t("credit_labelDuree")}</label>
            <input type="number" min="0" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} />
          </div>
        </div>
        {simulationValide && mensualite !== null && coutTotal !== null && totalInterets !== null && (
          <table className={styles.tableau}>
            <tbody>
              <tr>
                <td>{t("credit_resultatMensualite")}</td>
                <td className="chiffre">{mensualite.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>{t("credit_resultatTotalInterets")}</td>
                <td className="chiffre">{totalInterets.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>{t("credit_resultatCoutTotal")}</td>
                <td className="chiffre">{coutTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function DossierCreditPage() {
  return (
    <ProtectedGestionPage>
      <DossierCreditContenu />
    </ProtectedGestionPage>
  );
}
