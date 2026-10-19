"use client";

import { Fragment, useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Prêts réellement obtenus par ELEGANZ (19 oct. 2026 — "si on obtient un
// financement pour ELEGANZ, comment est-ce que cela sera géré ?"). Pendant
// plateforme de (gestion)/finance/prets. Distinct du simulateur et des
// scénarios du dossier crédit (/admin/finance/dossier-credit), purement
// théoriques : un prêt créé ici est effectivement décaissé et comptabilisé
// dès sa création, et chaque échéance comptabilisée réduit réellement son
// solde (voir LoansService).
interface Scenario {
  id: string;
  label: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
}

interface CompteTresorerie {
  id: string;
  label: string;
  account: { code: string; label: string };
}

interface Loan {
  id: string;
  label: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  devise: string;
  compteAccountCode: string;
  dateObtention: string;
  soldeRestant: number;
  statut: "ACTIF" | "TERMINE";
}

interface Echeance {
  id: string;
  periodDate: string;
  capital: number;
  interet: number;
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function PretsPlateformeContenu() {
  const { t } = useLocale();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [comptes, setComptes] = useState<CompteTresorerie[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultatEcheance, setResultatEcheance] = useState<Record<string, string>>({});
  const [echeancesOuvertes, setEcheancesOuvertes] = useState<Record<string, Echeance[]>>({});

  const [scenarioId, setScenarioId] = useState("");
  const [label, setLabel] = useState("");
  const [montant, setMontant] = useState("");
  const [tauxAnnuel, setTauxAnnuel] = useState("");
  const [dureeMois, setDureeMois] = useState("");
  const [devise, setDevise] = useState<"USD" | "CDF">("USD");
  const [compteAccountCode, setCompteAccountCode] = useState("5711");
  const [enCours, setEnCours] = useState(false);

  function recharger() {
    setChargement(true);
    api
      .get<Loan[]>("/admin/finance/loans")
      .then(setLoans)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    recharger();
    api
      .get<{ scenarios: Scenario[] }>("/admin/finance/business-plan")
      .then((plan) => setScenarios(plan.scenarios))
      .catch(() => setScenarios([]));
    api
      .get<CompteTresorerie[]>("/admin/finance/tresorerie-comptes")
      .then(setComptes)
      .catch(() => setComptes([]));
  }, []);

  function appliquerScenario(id: string) {
    setScenarioId(id);
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    setLabel(s.label);
    setMontant(String(s.montant));
    setTauxAnnuel(String(s.tauxAnnuel));
    setDureeMois(String(s.dureeMois));
  }

  async function obtenirPret(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !montant || !dureeMois) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/admin/finance/loans", {
        label,
        scenarioId: scenarioId || undefined,
        montant: Number(montant),
        tauxAnnuel: Number(tauxAnnuel) || 0,
        dureeMois: Number(dureeMois),
        devise,
        compteAccountCode,
      });
      setScenarioId("");
      setLabel("");
      setMontant("");
      setTauxAnnuel("");
      setDureeMois("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    } finally {
      setEnCours(false);
    }
  }

  async function comptabiliserEcheance(loanId: string) {
    setErreur(null);
    try {
      const resultat = await api.post<{ statut: string; capital: number; interet: number }>(
        `/admin/finance/loans/${loanId}/echeances`,
        {},
      );
      setResultatEcheance((prev) => ({
        ...prev,
        [loanId]:
          resultat.statut === "comptabilisee"
            ? `${t("pret_echeanceComptabilisee")} : ${f(resultat.capital)} + ${f(resultat.interet)} ${t("pret_interets")}`
            : resultat.statut === "deja_comptabilisee"
              ? t("pret_dejaComptabiliseeMois")
              : t("pret_pretTermine"),
      }));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    }
  }

  async function voirEcheances(loanId: string) {
    if (echeancesOuvertes[loanId]) {
      setEcheancesOuvertes((prev) => {
        const copie = { ...prev };
        delete copie[loanId];
        return copie;
      });
      return;
    }
    try {
      const lignes = await api.get<Echeance[]>(`/admin/finance/loans/${loanId}/echeances`);
      setEcheancesOuvertes((prev) => ({ ...prev, [loanId]: lignes }));
    } catch {
      // silencieux — simple confort d'affichage
    }
  }

  const optionsComptes = [
    { code: "5711", label: t("pret_caisseUsd") },
    { code: "5712", label: t("pret_caisseCdf") },
    ...comptes.map((c) => ({ code: c.account.code, label: `${c.label} (${c.account.code})` })),
  ];

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titrePrets")}</h1>
      <AdminFinanceSubNav />
      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>{t("pret_noteAide")}</p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <form onSubmit={obtenirPret} style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px", alignItems: "flex-end" }}>
        {scenarios.length > 0 && (
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("pret_depuisScenario")}</label>
            <select value={scenarioId} onChange={(e) => appliquerScenario(e.target.value)} style={{ minHeight: 40 }}>
              <option value="">{t("pret_aucunScenario")}</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("pret_libelle")}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("pret_placeholderLibelle")} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelMontant")}</label>
          <input type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelTaux")}</label>
          <input type="number" min="0" step="0.1" value={tauxAnnuel} onChange={(e) => setTauxAnnuel(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("credit_labelDuree")}</label>
          <input type="number" min="1" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("cha_devise")}</label>
          <select value={devise} onChange={(e) => setDevise(e.target.value as "USD" | "CDF")} style={{ minHeight: 40 }}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("pret_compteReception")}</label>
          <select value={compteAccountCode} onChange={(e) => setCompteAccountCode(e.target.value)} style={{ minHeight: 40 }}>
            {optionsComptes.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={enCours || !label || !montant || !dureeMois}>
          {enCours ? t("cha_enregistrementEnCours") : t("pret_obtenirCePret")}
        </button>
      </form>

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !loans || loans.length === 0 ? (
        <p>{t("pret_aucunPret")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("pret_libelle")}</th>
              <th style={{ textAlign: "left" }}>{t("pret_colObtenuLe")}</th>
              <th style={{ textAlign: "right" }}>{t("credit_labelMontant")}</th>
              <th style={{ textAlign: "right" }}>{t("pret_colSoldeRestant")}</th>
              <th style={{ textAlign: "left" }}>{t("rfi_colStatut")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <Fragment key={l.id}>
                <tr style={{ opacity: l.statut === "TERMINE" ? 0.5 : 1 }}>
                  <td>{l.label}</td>
                  <td>{new Date(l.dateObtention).toLocaleDateString("fr-FR")}</td>
                  <td style={{ textAlign: "right" }}>
                    {f(l.montant)} {l.devise}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {f(l.soldeRestant)} {l.devise}
                  </td>
                  <td>{l.statut === "ACTIF" ? t("pret_statutActif") : t("pret_statutTermine")}</td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    {l.statut === "ACTIF" && (
                      <button type="button" className={styles.bouton} onClick={() => comptabiliserEcheance(l.id)}>
                        {t("pret_comptabiliserEcheance")}
                      </button>
                    )}
                    <button type="button" onClick={() => voirEcheances(l.id)}>
                      {echeancesOuvertes[l.id] ? t("credit_masquerEcheancier") : t("credit_voirEcheancier")}
                    </button>
                  </td>
                </tr>
                {resultatEcheance[l.id] && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--color-vert-paiement)", fontSize: "0.8125rem" }}>
                      {resultatEcheance[l.id]}
                    </td>
                  </tr>
                )}
                {echeancesOuvertes[l.id] && (
                  <tr>
                    <td colSpan={6}>
                      {echeancesOuvertes[l.id].length === 0 ? (
                        <p style={{ margin: 0 }}>{t("pret_aucuneEcheance")}</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left" }}>{t("ana_colMois")}</th>
                              <th style={{ textAlign: "right" }}>{t("credit_echeancierCapital")}</th>
                              <th style={{ textAlign: "right" }}>{t("credit_echeancierInterets")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {echeancesOuvertes[l.id].map((e) => (
                              <tr key={e.id}>
                                <td>{new Date(e.periodDate).toLocaleDateString("fr-FR", { year: "numeric", month: "short" })}</td>
                                <td style={{ textAlign: "right" }}>{f(e.capital)}</td>
                                <td style={{ textAlign: "right" }}>{f(e.interet)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminPretsPage() {
  return (
    <AdminShell>
      <PretsPlateformeContenu />
    </AdminShell>
  );
}
