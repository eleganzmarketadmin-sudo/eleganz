"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { formatMoney } from "../../../lib/money";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface InstitutionCatalogue {
  id: string;
  name: string;
  type: "MICROFINANCE" | "BANQUE" | "COOPERATIVE" | "AUTRE";
}

interface Acces {
  id: string;
  institutionId: string;
  status: "ACTIVE" | "REVOKED";
  institution: { id: string; name: string; type: string };
  createdAt: string;
}

interface Decision {
  id: string;
  institution: { id: string; name: string };
  statut: "ACCORDE" | "REFUSE";
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  devise?: string;
  note: string | null;
  loanId: string | null;
  decaissable: boolean;
  createdAt: string;
}

interface CompteTresorerie {
  id: string;
  label: string;
  account: { code: string; label: string };
}

// Scénario de prêt du business plan (16 nov. 2026) — forme allégée de
// ScenarioPret (voir finance/dossier-credit/page.tsx) : seuls les champs
// utiles pour préremplir une DemandeCredit (le taux annuel ne concerne que
// le simulateur indicatif, jamais la candidature réelle soumise à
// l'institution).
interface ScenarioPretLeger {
  id: string;
  label: string;
  montant: number;
  dureeMois: number;
  objetFinancement: string | null;
}

// Candidature de crédit numérotée (16 nov. 2026, demande du propriétaire,
// point 1) — voir DemandeCreditService côté API. `montantDemande` n'a pas
// de devise propre dans le schéma (comme ScenarioPret) : affiché en
// nombre brut, jamais via formatMoney.
interface DemandeCreditBoutique {
  id: string;
  numero: string;
  statut: string;
  montantDemande: number;
  dureeMoisDemandee: number;
  objetFinancement: string | null;
  createdAt: string;
  institution: { id: string; name: string };
  decision: { statut: "ACCORDE" | "REFUSE"; loanId: string | null } | null;
}

/**
 * Côté boutique du portail institutions (14 nov. 2026) : choisir à quelles
 * institutions partager son dossier crédit, suivre leurs décisions, et
 * décaisser un prêt accordé. Rattaché à Finance & Comptabilité (plutôt qu'à
 * Dossier de crédit directement) parce qu'il réutilise déjà le même
 * business plan — voir le commentaire en tête de /finance/dossier-credit.
 */
function InstitutionsContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();

  const [catalogue, setCatalogue] = useState<InstitutionCatalogue[]>([]);
  const [acces, setAcces] = useState<Acces[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [institutionChoisie, setInstitutionChoisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [comptes, setComptes] = useState<CompteTresorerie[]>([]);
  const [decaissementOuvert, setDecaissementOuvert] = useState<string | null>(null);
  const [compteAccountCode, setCompteAccountCode] = useState("5711");
  const [labelPret, setLabelPret] = useState("");
  const [decaissementEnCours, setDecaissementEnCours] = useState(false);
  const [messageDecaissement, setMessageDecaissement] = useState<Record<string, string>>({});

  // Soumission de demande de crédit numérotée (16 nov. 2026, point 1) —
  // distincte de `partager` ci-dessus (ShopInstitutionAccess reste
  // l'autorisation permanente ; une DemandeCredit est une candidature
  // précise, numérotée, qu'on peut soumettre plusieurs fois dans le temps
  // à la même institution déjà autorisée).
  const [scenarios, setScenarios] = useState<ScenarioPretLeger[]>([]);
  const [demandes, setDemandes] = useState<DemandeCreditBoutique[]>([]);
  const [demandeInstitutionId, setDemandeInstitutionId] = useState("");
  const [demandeScenarioId, setDemandeScenarioId] = useState("");
  const [demandeMontant, setDemandeMontant] = useState("");
  const [demandeDuree, setDemandeDuree] = useState("");
  const [demandeObjet, setDemandeObjet] = useState("");
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  const [demandeErreur, setDemandeErreur] = useState<string | null>(null);
  const [demandeNumeroGenere, setDemandeNumeroGenere] = useState<string | null>(null);

  const peutGerer = currentShop?.myRole === "OWNER" || currentShop?.myRole === "MANAGER";

  function recharger() {
    if (!currentShop) return;
    api
      .get<Acces[]>(`/shops/${currentShop.id}/institutions`)
      .then(setAcces)
      .catch(() => {});
    api
      .get<Decision[]>(`/shops/${currentShop.id}/institutions/decisions`)
      .then(setDecisions)
      .catch(() => {});
    api
      .get<DemandeCreditBoutique[]>(`/shops/${currentShop.id}/institutions/demandes`)
      .then(setDemandes)
      .catch(() => {});
  }

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<InstitutionCatalogue[]>("/institutions/catalogue")
      .then(setCatalogue)
      .catch(() => setCatalogue([]));
    api
      .get<CompteTresorerie[]>(`/shops/${currentShop.id}/tresorerie/comptes`)
      .then(setComptes)
      .catch(() => setComptes([]));
    api
      .get<{ scenarios: ScenarioPretLeger[] }>(`/shops/${currentShop.id}/finance/business-plan`)
      .then((bp) => setScenarios(bp.scenarios))
      .catch(() => setScenarios([]));
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id]);

  const accesActifs = acces.filter((a) => a.status === "ACTIVE");
  const institutionsDisponibles = catalogue.filter((i) => !accesActifs.some((a) => a.institutionId === i.id));

  async function partager() {
    if (!currentShop || !institutionChoisie) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/institutions`, { institutionId: institutionChoisie });
      setInstitutionChoisie("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setEnCours(false);
    }
  }

  async function revoquer(institutionId: string) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/institutions/${institutionId}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    }
  }

  function choisirScenario(scenarioId: string) {
    setDemandeScenarioId(scenarioId);
    const s = scenarios.find((x) => x.id === scenarioId);
    if (s) {
      setDemandeMontant(String(s.montant));
      setDemandeDuree(String(s.dureeMois));
      setDemandeObjet(s.objetFinancement ?? "");
    }
  }

  async function soumettreDemande() {
    if (!currentShop || !demandeInstitutionId) return;
    const montantN = Number(demandeMontant);
    const dureeN = Number(demandeDuree);
    if (!(montantN > 0) || !(dureeN > 0)) return;
    setDemandeEnCours(true);
    setDemandeErreur(null);
    setDemandeNumeroGenere(null);
    try {
      const demande = await api.post<DemandeCreditBoutique>(`/shops/${currentShop.id}/institutions/demandes`, {
        institutionId: demandeInstitutionId,
        scenarioId: demandeScenarioId || undefined,
        montantDemande: montantN,
        dureeMoisDemandee: dureeN,
        objetFinancement: demandeObjet || undefined,
      });
      setDemandeNumeroGenere(demande.numero);
      setDemandeScenarioId("");
      setDemandeMontant("");
      setDemandeDuree("");
      setDemandeObjet("");
      recharger();
    } catch (err) {
      setDemandeErreur(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setDemandeEnCours(false);
    }
  }

  const optionsComptes = [
    { code: "5711", label: t("pret_caisseUsd") },
    { code: "5712", label: t("pret_caisseCdf") },
    ...comptes.map((c) => ({ code: c.account.code, label: `${c.label} (${c.account.code})` })),
  ];

  async function decaisser(decision: Decision) {
    if (!currentShop || !labelPret) return;
    setDecaissementEnCours(true);
    try {
      await api.post(`/shops/${currentShop.id}/finance/loans`, {
        label: labelPret,
        decisionId: decision.id,
        montant: decision.montant,
        tauxAnnuel: decision.tauxAnnuel,
        dureeMois: decision.dureeMois,
        compteAccountCode,
      });
      setMessageDecaissement((m) => ({ ...m, [decision.id]: t("inst_pretDecaisse") }));
      setDecaissementOuvert(null);
      setLabelPret("");
      recharger();
    } catch (err) {
      setMessageDecaissement((m) => ({ ...m, [decision.id]: err instanceof ApiError ? err.message : t("inst_erreurGeneration") }));
    } finally {
      setDecaissementEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("fin_titre")}</h1>
      <FinanceSubNav />
      <h2 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>{t("inst_gestionTitre")}</h2>
      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("inst_gestionDescription")}
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {peutGerer && (
        <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
          <h3 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_partagerTitre")}</h3>
          {institutionsDisponibles.length === 0 ? (
            <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneInstitutionDisponible")}</p>
          ) : (
            <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className={styles.champ} style={{ flex: 1, minWidth: "200px" }}>
                <label>{t("inst_choisirInstitution")}</label>
                <select value={institutionChoisie} onChange={(e) => setInstitutionChoisie(e.target.value)}>
                  <option value="">{t("inst_choisirInstitution")}</option>
                  {institutionsDisponibles.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {t(`inst_type_${i.type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <button className={styles.bouton} onClick={partager} disabled={enCours || !institutionChoisie}>
                {t("inst_partager")}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
        <h3 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_accesActuelsTitre")}</h3>
        {accesActifs.length === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucunAcces")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("inst_colInstitution")}</th>
                <th>{t("inst_colPartageDepuis")}</th>
                {peutGerer && <th></th>}
              </tr>
            </thead>
            <tbody>
              {accesActifs.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.institution.name} — {t(`inst_type_${a.institution.type}`)}
                  </td>
                  <td>{new Date(a.createdAt).toLocaleDateString("fr-FR")}</td>
                  {peutGerer && (
                    <td>
                      <button
                        onClick={() => revoquer(a.institutionId)}
                        style={{ background: "var(--color-flamme)", color: "#fff", border: "none", padding: "4px 10px", cursor: "pointer", fontSize: "0.8125rem" }}
                      >
                        {t("inst_revoquer")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {peutGerer && accesActifs.length > 0 && (
        <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
          <h3 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_soumettreDemandeTitre")}</h3>
          <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
            {t("inst_soumettreDemandeDescription")}
          </p>

          {demandeErreur && <div className={styles.erreur}>{demandeErreur}</div>}
          {demandeNumeroGenere && (
            <div style={{ background: "#d1e7dd", color: "#0f5132", padding: "var(--espace-3)", marginBottom: "var(--espace-3)" }}>
              <strong>
                {t("inst_demandeNumeroGenereLabel")} : {demandeNumeroGenere}
              </strong>
              <p style={{ margin: 0, fontSize: "0.8125rem" }}>{t("inst_demandeSoumissionReussie")}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className={styles.champ} style={{ minWidth: "200px" }}>
              <label>{t("inst_demandeLabelInstitution")}</label>
              <select value={demandeInstitutionId} onChange={(e) => setDemandeInstitutionId(e.target.value)}>
                <option value="">{t("inst_demandeLabelInstitution")}</option>
                {accesActifs.map((a) => (
                  <option key={a.institutionId} value={a.institutionId}>
                    {a.institution.name} — {t(`inst_type_${a.institution.type}`)}
                  </option>
                ))}
              </select>
            </div>
            {scenarios.length > 0 && (
              <div className={styles.champ} style={{ minWidth: "200px" }}>
                <label>{t("inst_demandeLabelScenario")}</label>
                <select value={demandeScenarioId} onChange={(e) => choisirScenario(e.target.value)}>
                  <option value="">{t("inst_scenarioLibre")}</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.champ}>
              <label>{t("credit_labelMontant")}</label>
              <input type="number" min="0" value={demandeMontant} onChange={(e) => setDemandeMontant(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("credit_labelDuree")}</label>
              <input type="number" min="0" value={demandeDuree} onChange={(e) => setDemandeDuree(e.target.value)} />
            </div>
            <div className={styles.champ} style={{ flex: 1, minWidth: "180px" }}>
              <label>{t("credit_bpColObjet")}</label>
              <input value={demandeObjet} onChange={(e) => setDemandeObjet(e.target.value)} />
            </div>
            <button
              className={styles.bouton}
              onClick={soumettreDemande}
              disabled={demandeEnCours || !demandeInstitutionId || !(Number(demandeMontant) > 0) || !(Number(demandeDuree) > 0)}
            >
              {demandeEnCours ? t("inst_demandeSoumissionEnCours") : t("inst_demandeSoumettre")}
            </button>
          </div>
        </div>
      )}

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)", marginBottom: "var(--espace-5)" }}>
        <h3 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_mesDemandesTitre")}</h3>
        {demandes.length === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneDemande")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("inst_colNumero")}</th>
                <th>{t("inst_colDate")}</th>
                <th>{t("inst_colInstitution")}</th>
                <th>{t("credit_labelMontant")}</th>
                <th>{t("inst_colStatut")}</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: "monospace" }}>{d.numero}</td>
                  <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>{d.institution.name}</td>
                  <td className="chiffre">{d.montantDemande.toLocaleString("fr-FR")}</td>
                  <td>{t(`inst_demandeStatut_${d.statut}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ border: "2px solid var(--color-ink)", padding: "var(--espace-4)" }}>
        <h3 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_decisionsRecuesTitre")}</h3>
        {decisions.length === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneDecision")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("inst_colDate")}</th>
                <th>{t("inst_colInstitution")}</th>
                <th>{t("inst_colStatut")}</th>
                <th>{t("credit_labelMontant")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>{d.institution.name}</td>
                  <td>{t(d.statut === "ACCORDE" ? "inst_statutAccorde" : "inst_statutRefuse")}</td>
                  <td className="chiffre">{formatMoney(d.montant, d.devise ?? "USD")}</td>
                  <td>
                    {d.loanId ? (
                      <span style={{ fontSize: "0.8125rem" }}>{t("inst_statutDecaisse")}</span>
                    ) : d.decaissable ? (
                      decaissementOuvert === d.id ? (
                        <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div className={styles.champ}>
                            <label>{t("pret_libelle")}</label>
                            <input value={labelPret} onChange={(e) => setLabelPret(e.target.value)} />
                          </div>
                          <div className={styles.champ}>
                            <label>{t("pret_compteReception")}</label>
                            <select value={compteAccountCode} onChange={(e) => setCompteAccountCode(e.target.value)}>
                              {optionsComptes.map((o) => (
                                <option key={o.code} value={o.code}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button className={styles.bouton} onClick={() => decaisser(d)} disabled={decaissementEnCours || !labelPret}>
                            {t("inst_confirmerDecaissement")}
                          </button>
                        </div>
                      ) : (
                        <button className={styles.bouton} onClick={() => setDecaissementOuvert(d.id)}>
                          {t("inst_decaisser")}
                        </button>
                      )
                    ) : null}
                    {messageDecaissement[d.id] && <p style={{ fontSize: "0.8125rem" }}>{messageDecaissement[d.id]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function InstitutionsPage() {
  return (
    <ProtectedGestionPage>
      <InstitutionsContenu />
    </ProtectedGestionPage>
  );
}
