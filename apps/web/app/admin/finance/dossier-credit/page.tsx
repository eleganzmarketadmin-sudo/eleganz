"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
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

interface BusinessPlanPlateforme {
  resumeExecutif: string | null;
  descriptionActivite: string | null;
  marcheEtClientele: string | null;
  strategieCroissance: string | null;
  utilisationFonds: string | null;
  risquesMitigation: string | null;
  scenarios: ScenarioPret[];
}

type ChampTexteBusinessPlan = Exclude<keyof BusinessPlanPlateforme, "scenarios">;

const CHAMPS_BUSINESS_PLAN: { cle: ChampTexteBusinessPlan; libelle: string; aide: string }[] = [
  { cle: "resumeExecutif", libelle: "credit_bpResumeExecutif", aide: "credit_bpResumeExecutifAide" },
  { cle: "descriptionActivite", libelle: "credit_bpDescriptionActivite", aide: "credit_bpDescriptionActiviteAide" },
  { cle: "marcheEtClientele", libelle: "credit_bpMarcheEtClientele", aide: "credit_bpMarcheEtClienteleAide" },
  { cle: "strategieCroissance", libelle: "credit_bpStrategieCroissance", aide: "credit_bpStrategieCroissanceAide" },
  { cle: "utilisationFonds", libelle: "credit_bpUtilisationFonds", aide: "credit_bpUtilisationFondsAide" },
  { cle: "risquesMitigation", libelle: "credit_bpRisquesMitigation", aide: "credit_bpRisquesMitigationAide" },
];

// Dossier de crédit d'ELEGANZ elle-même (demande du 16 oct. 2026, point 2)
// — pendant plateforme du dossier crédit boutique
// (/finance/dossier-credit), pour les besoins de financement d'ELEGANZ en
// tant que société. Même structure : business plan + scénarios de prêt
// persistés, PDF téléchargeable, assemblé à partir des écritures
// comptables réelles de la plateforme (scope PLATFORM).
function DossierCreditPlateformeContenu() {
  const { t } = useLocale();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Simulateur de remboursement (18 oct. 2026, audit du 18 oct. 2026 —
  // "fonctionnalités développées côté Gestion pas implémentées en détail au
  // Centre de pilotage") : ce bloc existait déjà pour la boutique
  // (/finance/dossier-credit) mais manquait entièrement ici — l'équipe
  // ELEGANZ ne pouvait tester une hypothèse de prêt qu'en créant un
  // scénario persisté, sans outil d'essai rapide. Même calcul, purement
  // indicatif et jamais enregistré.
  const [montant, setMontant] = useState("");
  const [tauxAnnuel, setTauxAnnuel] = useState("");
  const [dureeMois, setDureeMois] = useState("");

  const p = Number(montant);
  const n = Number(dureeMois);
  const r = Number(tauxAnnuel) / 100 / 12;
  const simulationValide = p > 0 && n > 0 && r > 0;
  const mensualite = simulationValide ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : null;
  const coutTotal = mensualite !== null ? mensualite * n : null;
  const totalInterets = coutTotal !== null ? coutTotal - p : null;

  // Échéancier détaillé mois par mois — même correctif que côté Gestion
  // (voir (gestion)/finance/dossier-credit/page.tsx pour le commentaire
  // complet sur le recalcul des intérêts sur solde réel et l'absorption de
  // l'arrondi sur la dernière échéance).
  const [echeancierVisible, setEcheancierVisible] = useState(false);
  const echeancier =
    simulationValide && mensualite !== null
      ? (() => {
          const lignes: { mois: number; interet: number; capital: number; solde: number }[] = [];
          let solde = p;
          for (let mois = 1; mois <= n; mois++) {
            const interet = solde * r;
            let capital = mensualite - interet;
            if (mois === n) capital = solde;
            solde = Math.max(0, solde - capital);
            lignes.push({ mois, interet, capital, solde });
          }
          return lignes;
        })()
      : null;

  const [businessPlan, setBusinessPlan] = useState<BusinessPlanPlateforme | null>(null);
  const [chargementBp, setChargementBp] = useState(true);
  const [sauvegardeBp, setSauvegardeBp] = useState(false);
  const [confirmationBp, setConfirmationBp] = useState(false);
  const [erreurBp, setErreurBp] = useState<string | null>(null);

  const [nouveauScenario, setNouveauScenario] = useState({ label: "", montant: "", tauxAnnuel: "", dureeMois: "", objetFinancement: "" });
  const [ajoutScenarioEnCours, setAjoutScenarioEnCours] = useState(false);

  function rechargerBusinessPlan() {
    api
      .get<BusinessPlanPlateforme>("/admin/finance/business-plan")
      .then(setBusinessPlan)
      .catch((err) => setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration")))
      .finally(() => setChargementBp(false));
  }

  useEffect(rechargerBusinessPlan, []);

  async function telecharger() {
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrirDocumentPdf("/admin/finance/export/dossier-credit?mois=12");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("credit_erreurGeneration"));
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrerBusinessPlan() {
    if (!businessPlan) return;
    setSauvegardeBp(true);
    setErreurBp(null);
    setConfirmationBp(false);
    try {
      const miseAJour = await api.patch<BusinessPlanPlateforme>("/admin/finance/business-plan", {
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
    const montantN = Number(nouveauScenario.montant);
    const tauxN = Number(nouveauScenario.tauxAnnuel);
    const dureeN = Number(nouveauScenario.dureeMois);
    if (!nouveauScenario.label || !(montantN > 0) || !(tauxN >= 0) || !(dureeN > 0)) return;
    setAjoutScenarioEnCours(true);
    setErreurBp(null);
    try {
      const miseAJour = await api.post<BusinessPlanPlateforme>("/admin/finance/business-plan/scenarios", {
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
    setErreurBp(null);
    try {
      const miseAJour = await api.delete<BusinessPlanPlateforme>(`/admin/finance/business-plan/scenarios/${scenarioId}`);
      setBusinessPlan(miseAJour);
    } catch (err) {
      setErreurBp(err instanceof ApiError ? err.message : t("credit_erreurGeneration"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admcredit_titre")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("admcredit_sousTitre")}
      </p>

      <div style={{ background: "#fff3cd", color: "#664d03", padding: "16px", marginBottom: "20px", fontWeight: 600, fontSize: "0.875rem" }}>
        {t("credit_avertissement")}
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "16px", marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "8px" }}>{t("dossier_contenuTitre")}</h2>
        <ul style={{ paddingLeft: "16px", marginBottom: "16px" }}>
          <li>{t("credit_listeHistorique")}</li>
          <li>{t("credit_listeBilan")}</li>
          <li>{t("admcredit_listeRevenus")}</li>
          <li>{t("credit_listeBusinessPlan")}</li>
          <li>{t("dossier_codeVerification")}</li>
        </ul>

        {erreur && <div className={styles.erreur}>{erreur}</div>}

        <button className={styles.bouton} onClick={telecharger} disabled={enCours}>
          {enCours ? t("dossier_genererEnCours") : t("dossier_telechargerPdf")}
        </button>
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "16px" }}>
        <h2 style={{ marginBottom: "8px" }}>{t("credit_bpTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "12px" }}>
          {t("credit_bpDescription")}
        </p>

        {chargementBp ? (
          <p>{t("commun_chargement")}</p>
        ) : businessPlan ? (
          <>
            {erreurBp && <div className={styles.erreur}>{erreurBp}</div>}
            {confirmationBp && <div style={{ color: "#0f5132", marginBottom: "12px" }}>{t("credit_bpEnregistre")}</div>}

            {CHAMPS_BUSINESS_PLAN.map(({ cle, libelle, aide }) => (
              <div key={cle} style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t(libelle)}</label>
                <textarea
                  rows={3}
                  value={businessPlan[cle] ?? ""}
                  onChange={(e) => setBusinessPlan({ ...businessPlan, [cle]: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "2px solid var(--color-ink)", font: "inherit" }}
                />
                <p style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>{t(aide)}</p>
              </div>
            ))}

            <button className={styles.bouton} onClick={enregistrerBusinessPlan} disabled={sauvegardeBp}>
              {sauvegardeBp ? t("dossier_genererEnCours") : t("credit_bpEnregistrer")}
            </button>

            <h3 style={{ marginTop: "24px", marginBottom: "8px" }}>{t("credit_bpScenariosTitre")}</h3>
            <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "12px" }}>
              {t("credit_bpScenariosDescription")}
            </p>

            {businessPlan.scenarios.length === 0 ? (
              <p style={{ color: "var(--color-texte-muted)", marginBottom: "12px" }}>{t("credit_bpAucunScenario")}</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>{t("credit_bpColLabel")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_labelMontant")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_labelTaux")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_labelDuree")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_resultatMensualite")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {businessPlan.scenarios.map((s) => (
                    <tr key={s.id}>
                      <td>{s.label}</td>
                      <td style={{ textAlign: "right" }}>{s.montant.toLocaleString("fr-FR")}</td>
                      <td style={{ textAlign: "right" }}>{s.tauxAnnuel.toLocaleString("fr-FR")} %</td>
                      <td style={{ textAlign: "right" }}>{s.dureeMois}</td>
                      <td style={{ textAlign: "right" }}>{s.mensualite.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
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

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_bpColLabel")}</label>
                <input value={nouveauScenario.label} onChange={(e) => setNouveauScenario({ ...nouveauScenario, label: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelMontant")}</label>
                <input type="number" min="0" value={nouveauScenario.montant} onChange={(e) => setNouveauScenario({ ...nouveauScenario, montant: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelTaux")}</label>
                <input type="number" min="0" step="0.1" value={nouveauScenario.tauxAnnuel} onChange={(e) => setNouveauScenario({ ...nouveauScenario, tauxAnnuel: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelDuree")}</label>
                <input type="number" min="0" value={nouveauScenario.dureeMois} onChange={(e) => setNouveauScenario({ ...nouveauScenario, dureeMois: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_bpColObjet")}</label>
                <input value={nouveauScenario.objetFinancement} onChange={(e) => setNouveauScenario({ ...nouveauScenario, objetFinancement: e.target.value })} />
              </div>
              <button className={styles.bouton} onClick={ajouterScenario} disabled={ajoutScenarioEnCours}>
                {t("credit_bpAjouterScenario")}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "16px", marginTop: "20px" }}>
        <h2 style={{ marginBottom: "8px" }}>{t("credit_simulateurTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "12px" }}>
          {t("credit_simulateurDescription")}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelMontant")}</label>
            <input type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelTaux")}</label>
            <input type="number" min="0" step="0.1" value={tauxAnnuel} onChange={(e) => setTauxAnnuel(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelDuree")}</label>
            <input type="number" min="0" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} />
          </div>
        </div>

        {simulationValide && mensualite !== null && coutTotal !== null && totalInterets !== null && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td>{t("credit_resultatMensualite")}</td>
                  <td style={{ textAlign: "right" }}>{mensualite.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>{t("credit_resultatTotalInterets")}</td>
                  <td style={{ textAlign: "right" }}>{totalInterets.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>{t("credit_resultatCoutTotal")}</td>
                  <td style={{ textAlign: "right" }}>{coutTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <button type="button" className={styles.bouton} style={{ marginTop: "12px" }} onClick={() => setEcheancierVisible((v) => !v)}>
              {echeancierVisible ? t("credit_masquerEcheancier") : t("credit_voirEcheancier")}
            </button>

            {echeancierVisible && echeancier && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>{t("credit_echeancierMois")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_echeancierInterets")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_echeancierCapital")}</th>
                    <th style={{ textAlign: "right" }}>{t("credit_echeancierSolde")}</th>
                  </tr>
                </thead>
                <tbody>
                  {echeancier.map((ligne) => (
                    <tr key={ligne.mois}>
                      <td>{ligne.mois}</td>
                      <td style={{ textAlign: "right" }}>{ligne.interet.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: "right" }}>{ligne.capital.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: "right" }}>{ligne.solde.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminDossierCreditPage() {
  return (
    <AdminShell>
      <DossierCreditPlateformeContenu />
    </AdminShell>
  );
}
