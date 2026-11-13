"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Simulation fiscale (13 oct. 2026, Finance & Comptabilité Phase 7) — voir
// docs/ARCHITECTURE_FINANCE.md §8septies. À partir des règles fiscales
// réellement configurées et des données comptables réelles de la période —
// jamais une déclaration officielle, toujours un ordre de grandeur.
//
// Devenu un RELEVÉ (13 nov. 2026, signalement : "aucune option pour voir
// les récap/relevés ... qu'on peut s'en servir ... pour la déclaration ou
// contre-vérification ... et pour les reversements") — GET
// /shops/:shopId/finance/releve-fiscal (remplace simulation-fiscale ici)
// ajoute à chaque ligne ce qui a RÉELLEMENT été reversé (montantVerse) et ce
// qu'il reste (solde), et permet d'enregistrer/consulter les reversements de
// chaque règle, y compris les règles non simulables (IRPP, INPP). Même
// limite volontaire que côté Centre de pilotage : pas de sélecteur de
// devise ici, USD par défaut, pour ne jamais fusionner silencieusement USD
// et CDF (voir compteDeResultat).
interface LigneSimulation {
  ruleId: string;
  label: string;
  category: string;
  rateOrFormula: string;
  base: string;
  montantBase: number;
  taux: number;
  montantEstime: number;
  montantVerse: number;
  solde: number;
}

interface RegleNonSimulable {
  ruleId: string;
  label: string;
  rateOrFormula: string;
  motif: string;
  montantVerse: number;
  montantDeclare: number;
}

interface Releve {
  periode: { from: string; to: string };
  chiffreAffaires: number;
  resultatNet: number;
  lignes: LigneSimulation[];
  nonSimulables: RegleNonSimulable[];
  totalEstime: number;
  totalVerse: number;
}

interface Reversement {
  id: string;
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  declaredAmount: string | number | null;
  paidAmount: string | number;
  dueDate: string | null;
  paidAt: string;
  reference: string | null;
  note: string | null;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function debutMois(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function SimulationFiscaleContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [releve, setReleve] = useState<Releve | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [formulaireOuvertPour, setFormulaireOuvertPour] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodFrom, setPeriodFrom] = useState(from);
  const [periodTo, setPeriodTo] = useState(to);
  const [paidAmount, setPaidAmount] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [paidAt, setPaidAt] = useState(aujourdhui());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  const [historiqueOuvertPour, setHistoriqueOuvertPour] = useState<string | null>(null);
  const [historiques, setHistoriques] = useState<Record<string, Reversement[]>>({});
  const [chargementHistorique, setChargementHistorique] = useState(false);

  function charger() {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<Releve>(
        `/shops/${currentShop.id}/finance/releve-fiscal?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`,
      )
      .then(setReleve)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(charger, [currentShop, from, to]);

  function ouvrirFormulaire(ruleId: string) {
    setFormulaireOuvertPour(ruleId);
    setPeriodLabel("");
    setPeriodFrom(from);
    setPeriodTo(to);
    setPaidAmount("");
    setDeclaredAmount("");
    setPaidAt(aujourdhui());
    setReference("");
    setNote("");
    setErreur(null);
    setMessage(null);
  }

  function fermerFormulaire() {
    setFormulaireOuvertPour(null);
  }

  async function chargerHistorique(ruleId: string) {
    if (!currentShop) return;
    if (historiqueOuvertPour === ruleId) {
      setHistoriqueOuvertPour(null);
      return;
    }
    setHistoriqueOuvertPour(ruleId);
    if (historiques[ruleId]) return;
    setChargementHistorique(true);
    try {
      const liste = await api.get<Reversement[]>(
        `/shops/${currentShop.id}/finance/fiscal-rules/${ruleId}/remittances`,
      );
      setHistoriques((h) => ({ ...h, [ruleId]: liste }));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rev_erreurChargement"));
    } finally {
      setChargementHistorique(false);
    }
  }

  async function soumettreReversement(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop || !formulaireOuvertPour || !periodLabel || !paidAmount) return;
    setEnregistrementEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.post(`/shops/${currentShop.id}/finance/fiscal-rules/${formulaireOuvertPour}/remittances`, {
        periodLabel,
        periodFrom: new Date(periodFrom).toISOString(),
        periodTo: new Date(periodTo).toISOString(),
        paidAmount: Number(paidAmount),
        declaredAmount: declaredAmount ? Number(declaredAmount) : undefined,
        paidAt: new Date(paidAt).toISOString(),
        reference: reference || undefined,
        note: note || undefined,
      });
      setMessage(t("rev_reversementEnregistre"));
      setHistoriques((h) => {
        const { [formulaireOuvertPour]: _retire, ...reste } = h;
        return reste;
      });
      fermerFormulaire();
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function supprimerReversement(ruleId: string, remittanceId: string) {
    if (!currentShop) return;
    if (!window.confirm(t("rev_confirmerSuppression"))) return;
    try {
      await api.delete(`/shops/${currentShop.id}/finance/fiscal-rules/${ruleId}/remittances/${remittanceId}`);
      setHistoriques((h) => {
        const { [ruleId]: _retire, ...reste } = h;
        return reste;
      });
      charger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rev_erreurChargement"));
    }
  }

  function formulaireReversement(ruleId: string) {
    if (formulaireOuvertPour !== ruleId) return null;
    return (
      <form onSubmit={soumettreReversement} style={{ display: "flex", flexWrap: "wrap", gap: "12px", margin: "12px 0", padding: "12px", border: "1px solid #ddd" }}>
        <input placeholder={t("rev_periodeLabel")} value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        <div>
          <label style={{ display: "block", fontSize: "0.8rem" }}>{t("rev_periodeDu")}</label>
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem" }}>{t("rev_periodeAu")}</label>
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </div>
        <input type="number" step="0.01" placeholder={t("rev_montantVerse")} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        <input type="number" step="0.01" placeholder={t("rev_montantDeclare")} value={declaredAmount} onChange={(e) => setDeclaredAmount(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        <div>
          <label style={{ display: "block", fontSize: "0.8rem" }}>{t("rev_datePaiement")}</label>
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <input placeholder={t("rev_reference")} value={reference} onChange={(e) => setReference(e.target.value)} style={{ minHeight: 40, padding: 8, minWidth: 220 }} />
        <input placeholder={t("rev_note")} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 40, padding: 8, minWidth: 180 }} />
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="submit" disabled={enregistrementEnCours || !periodLabel || !paidAmount}>
            {enregistrementEnCours ? t("cha_enregistrementEnCours") : t("rev_enregistrer")}
          </button>
          <button type="button" onClick={fermerFormulaire}>
            {t("rev_annuler")}
          </button>
        </div>
      </form>
    );
  }

  function historiqueReversements(ruleId: string) {
    if (historiqueOuvertPour !== ruleId) return null;
    const liste = historiques[ruleId];
    return (
      <div style={{ margin: "8px 0 16px", padding: "8px 12px", background: "var(--color-surface-muted, #f5f5f5)" }}>
        <strong style={{ fontSize: "0.85rem" }}>{t("rev_historique")}</strong>
        {chargementHistorique && !liste ? (
          <p style={{ fontSize: "0.85rem" }}>{t("commun_chargement")}</p>
        ) : !liste || liste.length === 0 ? (
          <p style={{ fontSize: "0.85rem" }}>{t("rev_aucunReversement")}</p>
        ) : (
          <table style={{ width: "100%", fontSize: "0.85rem", marginTop: "6px" }}>
            <tbody>
              {liste.map((r) => (
                <tr key={r.id}>
                  <td>{r.periodLabel}</td>
                  <td style={{ textAlign: "right" }}>{f(r.paidAmount)} $</td>
                  <td>{new Date(r.paidAt).toLocaleDateString("fr-FR")}</td>
                  <td>{r.reference || "—"}</td>
                  <td>
                    <button onClick={() => supprimerReversement(ruleId, r.id)}>{t("rev_supprimer")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("fin_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("sim_noteAide1")} <strong>{t("sim_noteAideGras")}</strong> {t("sim_noteAide2")}
      </p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label>{t("rel_du")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label>{t("rel_au")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {message && <div className={styles.message ?? undefined}>{message}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !releve ? (
        <p>{t("fin_aucuneDonnee")}</p>
      ) : (
        <>
          <p>
            {t("sim_chiffreAffairesPeriode")} {f(releve.chiffreAffaires)} $ — {t("sim_resultatNet")}{" "}
            {f(releve.resultatNet)} $
          </p>

          {releve.lignes.length === 0 ? (
            <p>{t("sim_aucuneRegle")}</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{t("sim_colRegle")}</th>
                  <th>{t("sim_colBase")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colMontantBase")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colTaux")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colEstimation")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colVerse")}</th>
                  <th style={{ textAlign: "right" }}>{t("sim_colSolde")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {releve.lignes.map((l) => (
                  <>
                    <tr key={l.ruleId}>
                      <td>{l.label}</td>
                      <td>{l.base}</td>
                      <td style={{ textAlign: "right" }}>{f(l.montantBase)} $</td>
                      <td style={{ textAlign: "right" }}>{l.taux} %</td>
                      <td style={{ textAlign: "right" }}>{f(l.montantEstime)} $</td>
                      <td style={{ textAlign: "right" }}>{f(l.montantVerse)} $</td>
                      <td style={{ textAlign: "right", fontWeight: l.solde > 0 ? 700 : 400 }}>{f(l.solde)} $</td>
                      <td style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => ouvrirFormulaire(l.ruleId)}>{t("rev_ajouterReversement")}</button>
                        <button onClick={() => chargerHistorique(l.ruleId)}>{t("rev_historique")}</button>
                      </td>
                    </tr>
                    {formulaireOuvertPour === l.ruleId && (
                      <tr>
                        <td colSpan={8}>{formulaireReversement(l.ruleId)}</td>
                      </tr>
                    )}
                    {historiqueOuvertPour === l.ruleId && (
                      <tr>
                        <td colSpan={8}>{historiqueReversements(l.ruleId)}</td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>{t("sim_totalEstime")}</td>
                  <td style={{ textAlign: "right" }}>{f(releve.totalEstime)} $</td>
                  <td style={{ textAlign: "right" }}>{f(releve.totalVerse)} $</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}

          {releve.nonSimulables.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3>{t("sim_reglesNonSimulables")}</h3>
              <ul>
                {releve.nonSimulables.map((r) => (
                  <li key={r.ruleId} style={{ marginBottom: "8px" }}>
                    <strong>{r.label}</strong> ({r.rateOrFormula}) — {r.motif}
                    <br />
                    {t("sim_colVerse")}: {f(r.montantVerse)} $
                    {r.montantDeclare > 0 && <> — {t("rev_montantDeclare")}: {f(r.montantDeclare)} $</>}
                    {" — "}
                    <button onClick={() => ouvrirFormulaire(r.ruleId)}>{t("rev_ajouterReversement")}</button>{" "}
                    <button onClick={() => chargerHistorique(r.ruleId)}>{t("rev_historique")}</button>
                    {formulaireReversement(r.ruleId)}
                    {historiqueReversements(r.ruleId)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SimulationFiscalePage() {
  return (
    <ProtectedGestionPage>
      <SimulationFiscaleContenu />
    </ProtectedGestionPage>
  );
}
