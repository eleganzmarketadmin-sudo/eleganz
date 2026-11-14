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
