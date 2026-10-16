"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface ScenarioPret {
  id: string;
  label: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  objetFinancement: string | null;
  mensualite: number;
}

interface BusinessPlanBoutique {
  resumeExecutif: string | null;
  descriptionActivite: string | null;
  marcheEtClientele: string | null;
  strategieCroissance: string | null;
  utilisationFonds: string | null;
  risquesMitigation: string | null;
  scenarios: ScenarioPret[];
}

type ChampTexteBusinessPlan = Exclude<keyof BusinessPlanBoutique, "scenarios">;

const CHAMPS_BUSINESS_PLAN: { cle: ChampTexteBusinessPlan; libelle: string; aide: string }[] = [
  { cle: "resumeExecutif", libelle: "credit_bpResumeExecutif", aide: "credit_bpResumeExecutifAide" },
  { cle: "descriptionActivite", libelle: "credit_bpDescriptionActivite", aide: "credit_bpDescriptionActiviteAide" },
  { cle: "marcheEtClientele", libelle: "credit_bpMarcheEtClientele", aide: "credit_bpMarcheEtClienteleAide" },
  { cle: "strategieCroissance", libelle: "credit_bpStrategieCroissance", aide: "credit_bpStrategieCroissanceAide" },
  { cle: "utilisationFonds", libelle: "credit_bpUtilisationFonds", aide: "credit_bpUtilisationFondsAide" },
  { cle: "risquesMitigation", libelle: "credit_bpRisquesMitigation", aide: "credit_bpRisquesMitigationAide" },
];

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

  // Business plan et scénarios de prêt (16 oct. 2026, point 1) — persistés
  // côté API (GET/PATCH business-plan, POST/DELETE business-plan/scenarios),
  // à la différence du simulateur ci-dessous qui reste un calcul purement
  // indicatif, jamais enregistré.
  const [businessPlan, setBusinessPlan] = useState<BusinessPlanBoutique | null>(null);
  const [chargementBp, setChargementBp] = useState(true);
  const [sauvegardeBp, setSauvegardeBp] = useState(false);
  const [confirmationBp, setConfirmationBp] = useState(false);
  const [erreurBp, setErreurBp] = useState<string | null>(null);

  const [nouveauScenario, setNouveauScenario] = useState({ label: "", montant: "", tauxAnnuel: "", dureeMois: "", objetFinancement: "" });
  const [ajoutScenarioEnCours, setAjoutScenarioEnCours] = useState(false);

  function rechargerBusinessPlan() {
    if (!currentShop) return;
    api
      .get<BusinessPlanBoutique>(`/shops/${currentShop.id}/finance/business-plan`)
      .then(setBusinessPlan)
      .catch((err) => setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration")))
      .finally(() => setChargementBp(false));
  }

  useEffect(rechargerBusinessPlan, [currentShop?.id]);

  async function enregistrerBusinessPlan() {
    if (!currentShop || !businessPlan) return;
    setSauvegardeBp(true);
    setErreurBp(null);
    setConfirmationBp(false);
    try {
      const miseAJour = await api.patch<BusinessPlanBoutique>(`/shops/${currentShop.id}/finance/business-plan`, {
        resumeExecutif: businessPlan.resumeExecutif || undefined,
        descriptionActivite: businessPlan.descriptionActivite || undefined,
        marcheEtClientele: businessPlan.marcheEtClientele || undefined,
        strategieCroissance: businessPlan.strategieCroissance || undefined,
        utilisationFonds: businessPlan.utilisationFonds || undefined,
        risquesMitigation: businessPlan.risquesMitigation || undefined,
      });
      setBusinessPlan(miseAJour);
      setConfirmationBp(true);
    } catch (err) {
      setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration"));
    } finally {
      setSauvegardeBp(false);
    }
  }

  async function ajouterScenario() {
    if (!currentShop) return;
    const montantN = Number(nouveauScenario.montant);
    const tauxN = Number(nouveauScenario.tauxAnnuel);
    const dureeN = Number(nouveauScenario.dureeMois);
    if (!nouveauScenario.label || !(montantN > 0) || !(tauxN >= 0) || !(dureeN > 0)) return;
    setAjoutScenarioEnCours(true);
    setErreurBp(null);
    try {
      const miseAJour = await api.post<BusinessPlanBoutique>(`/shops/${currentShop.id}/finance/business-plan/scenarios`, {
        label: nouveauScenario.label,
        montant: montantN,
        tauxAnnuel: tauxN,
        dureeMois: dureeN,
        objetFinancement: nouveauScenario.objetFinancement || undefined,
      });
      setBusinessPlan(miseAJour);
      setNouveauScenario({ label: "", montant: "", tauxAnnuel: "", dureeMois: "", objetFinancement: "" });
    } catch (err) {
      setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration"));
    } finally {
      setAjoutScenarioEnCours(false);
    }
  }

  async function supprimerScenario(scenarioId: string) {
    if (!currentShop) return;
    setErreurBp(null);
    try {
      const miseAJour = await api.delete<BusinessPlanBoutique>(
        `/shops/${currentShop.id}/finance/business-plan/scenarios/${scenarioId}`,
      );
      setBusinessPlan(miseAJour);
    } catch (err) {
      setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration"));
    }
  }

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
          <li>{t("credit_listeBusinessPlan")}</li>
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

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("credit_bpTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
          {t("credit_bpDescription")}
        </p>

        {chargementBp ? (
          <p>{t("commun_chargement")}</p>
        ) : businessPlan ? (
          <>
            {erreurBp && <div className={styles.erreur}>{erreurBp}</div>}
            {confirmationBp && (
              <div style={{ color: "#0f5132", marginBottom: "var(--espace-3)" }}>{t("credit_bpEnregistre")}</div>
            )}

            {CHAMPS_BUSINESS_PLAN.map(({ cle, libelle, aide }) => (
              <div className={styles.champ} key={cle} style={{ marginBottom: "var(--espace-3)" }}>
                <label>{t(libelle)}</label>
                <textarea
                  rows={3}
                  value={businessPlan[cle] ?? ""}
                  onChange={(e) => setBusinessPlan({ ...businessPlan, [cle]: e.target.value })}
                  style={{ width: "100%", padding: "var(--espace-2)", border: "2px solid var(--color-ink)", font: "inherit" }}
                />
                <p style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>{t(aide)}</p>
              </div>
            ))}

            <button className={styles.bouton} onClick={enregistrerBusinessPlan} disabled={sauvegardeBp}>
              {sauvegardeBp ? t("dossier_genererEnCours") : t("credit_bpEnregistrer")}
            </button>

            <h3 style={{ marginTop: "var(--espace-5)", marginBottom: "var(--espace-2)" }}>{t("credit_bpScenariosTitre")}</h3>
            <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
              {t("credit_bpScenariosDescription")}
            </p>

            {businessPlan.scenarios.length === 0 ? (
              <p style={{ color: "var(--color-texte-muted)", marginBottom: "var(--espace-3)" }}>{t("credit_bpAucunScenario")}</p>
            ) : (
              <table className={styles.tableau} style={{ marginBottom: "var(--espace-4)" }}>
                <thead>
                  <tr>
                    <th>{t("credit_bpColLabel")}</th>
                    <th>{t("credit_labelMontant")}</th>
                    <th>{t("credit_labelTaux")}</th>
                    <th>{t("credit_labelDuree")}</th>
                    <th>{t("credit_resultatMensualite")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {businessPlan.scenarios.map((s) => (
                    <tr key={s.id}>
                      <td>{s.label}</td>
                      <td className="chiffre">{s.montant.toLocaleString("fr-FR")}</td>
                      <td className="chiffre">{s.tauxAnnuel.toLocaleString("fr-FR")} %</td>
                      <td className="chiffre">{s.dureeMois}</td>
                      <td className="chiffre">{s.mensualite.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      <td>
                        <button
                          onClick={() => supprimerScenario(s.id)}
                          style={{ background: "var(--color-flamme)", color: "#fff", border: "none", padding: "4px 10px", cursor: "pointer", fontSize: "0.8125rem" }}
                        >
                          {t("action_supprimer")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className={styles.champ}>
                <label>{t("credit_bpColLabel")}</label>
                <input value={nouveauScenario.label} onChange={(e) => setNouveauScenario({ ...nouveauScenario, label: e.target.value })} />
              </div>
              <div className={styles.champ}>
                <label>{t("credit_labelMontant")}</label>
                <input type="number" min="0" value={nouveauScenario.montant} onChange={(e) => setNouveauScenario({ ...nouveauScenario, montant: e.target.value })} />
              </div>
              <div className={styles.champ}>
                <label>{t("credit_labelTaux")}</label>
                <input type="number" min="0" step="0.1" value={nouveauScenario.tauxAnnuel} onChange={(e) => setNouveauScenario({ ...nouveauScenario, tauxAnnuel: e.target.value })} />
              </div>
              <div className={styles.champ}>
                <label>{t("credit_labelDuree")}</label>
                <input type="number" min="0" value={nouveauScenario.dureeMois} onChange={(e) => setNouveauScenario({ ...nouveauScenario, dureeMois: e.target.value })} />
              </div>
              <div className={styles.champ} style={{ flex: 1, minWidth: "180px" }}>
                <label>{t("credit_bpColObjet")}</label>
                <input value={nouveauScenario.objetFinancement} onChange={(e) => setNouveauScenario({ ...nouveauScenario, objetFinancement: e.target.value })} />
              </div>
              <button className={styles.bouton} onClick={ajouterScenario} disabled={ajoutScenarioEnCours}>
                {t("credit_bpAjouterScenario")}
              </button>
            </div>
          </>
        ) : null}
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
