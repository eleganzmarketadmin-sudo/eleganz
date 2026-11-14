"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface Pret {
  id: string;
  shopId: string | null;
  shop: { id: string; name: string; slug: string } | null;
  label: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  devise: string;
  dateObtention: string;
  soldeRestant: number;
  statut: "ACTIF" | "TERMINE";
  institutionCommissionAmount: number | null;
  suiviRemboursementParInstitution: boolean;
}

interface Echeance {
  id: string;
  periodDate: string;
  capital: number;
  interet: number;
}

/**
 * Prêts décaissés par cette institution, toutes boutiques confondues (14
 * nov. 2026) — distinct des décisions : un prêt n'apparaît ici qu'une fois
 * la boutique elle-même décaissée (voir LoansService.obtenirPretViaDecision).
 * "Comptabiliser l'échéance" n'est proposé que si `suiviRemboursementParInstitution`
 * est vrai, choix fait par l'institution elle-même au moment de sa décision
 * ("suivi des remboursements optionnel") — sinon la boutique/l'admin reste
 * seule à comptabiliser, comme avant ce portail.
 */
function PretsContenu() {
  const { t } = useLocale();
  const [prets, setPrets] = useState<Pret[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [messageParPret, setMessageParPret] = useState<Record<string, string>>({});
  const [echeancesVisibles, setEcheancesVisibles] = useState<Record<string, Echeance[]>>({});

  function recharger() {
    api
      .get<Pret[]>("/institution-portal/loans")
      .then(setPrets)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
  }

  useEffect(recharger, []);

  async function comptabiliser(pret: Pret) {
    if (!pret.shopId) return;
    setEnCoursId(pret.id);
    setMessageParPret((m) => ({ ...m, [pret.id]: "" }));
    try {
      const resultat = await api.post<{ statut: string; capital: number; interet: number }>(
        `/institution-portal/shops/${pret.shopId}/loans/${pret.id}/echeances`,
      );
      const cle =
        resultat.statut === "deja_comptabilisee"
          ? "inst_echeanceDejaComptabilisee"
          : resultat.statut === "termine"
            ? "inst_pretTermine"
            : "inst_echeanceComptabilisee";
      setMessageParPret((m) => ({ ...m, [pret.id]: t(cle) }));
      recharger();
    } catch (err) {
      setMessageParPret((m) => ({ ...m, [pret.id]: err instanceof ApiError ? err.message : t("inst_erreurGeneration") }));
    } finally {
      setEnCoursId(null);
    }
  }

  async function voirEcheances(pret: Pret) {
    if (!pret.shopId) return;
    if (echeancesVisibles[pret.id]) {
      setEcheancesVisibles((e) => {
        const { [pret.id]: _retire, ...reste } = e;
        return reste;
      });
      return;
    }
    try {
      const lignes = await api.get<Echeance[]>(`/institution-portal/shops/${pret.shopId}/loans/${pret.id}/echeances`);
      setEcheancesVisibles((e) => ({ ...e, [pret.id]: lignes }));
    } catch {
      // affichage non bloquant
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_nav_prets")}</h1>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {prets === null && !erreur ? (
        <p>{t("commun_chargement")}</p>
      ) : prets && prets.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucunPret")}</p>
      ) : prets ? (
        prets.map((p) => (
          <div className={styles.carte} key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--espace-2)", marginBottom: "var(--espace-2)" }}>
              <h2 style={{ margin: 0 }}>
                {p.shop ? (
                  <Link href={`/institution/boutiques/${p.shop.id}`} style={{ textDecoration: "underline" }}>
                    {p.shop.name}
                  </Link>
                ) : (
                  p.label
                )}
              </h2>
              <span className={`${styles.badge} ${p.statut === "TERMINE" ? styles.badgeDecaisse : styles.badgeAccorde}`}>
                {t(p.statut === "TERMINE" ? "inst_pretTermine" : "inst_pretActif")}
              </span>
            </div>
            <table className={styles.tableau} style={{ marginBottom: "var(--espace-3)" }}>
              <tbody>
                <tr>
                  <td>{t("credit_labelMontant")}</td>
                  <td className="chiffre">{formatMoney(p.montant, p.devise)}</td>
                </tr>
                <tr>
                  <td>{t("inst_colSoldeRestant")}</td>
                  <td className="chiffre">{formatMoney(p.soldeRestant, p.devise)}</td>
                </tr>
                <tr>
                  <td>{t("credit_labelTaux")}</td>
                  <td className="chiffre">{p.tauxAnnuel.toLocaleString("fr-FR")} %</td>
                </tr>
                <tr>
                  <td>{t("credit_labelDuree")}</td>
                  <td className="chiffre">{p.dureeMois}</td>
                </tr>
                {p.institutionCommissionAmount != null && (
                  <tr>
                    <td>{t("inst_colCommissionEleganz")}</td>
                    <td className="chiffre">{formatMoney(p.institutionCommissionAmount, p.devise)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {p.suiviRemboursementParInstitution && p.statut === "ACTIF" && (
              <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--espace-2)" }}>
                <button className={styles.bouton} onClick={() => comptabiliser(p)} disabled={enCoursId === p.id}>
                  {enCoursId === p.id ? t("dossier_genererEnCours") : t("inst_comptabiliserEcheance")}
                </button>
                <button className={styles.boutonSecondaire} onClick={() => voirEcheances(p)} type="button">
                  {echeancesVisibles[p.id] ? t("credit_masquerEcheancier") : t("credit_voirEcheancier")}
                </button>
              </div>
            )}
            {messageParPret[p.id] && <p style={{ fontSize: "0.875rem" }}>{messageParPret[p.id]}</p>}

            {echeancesVisibles[p.id] && (
              <table className={styles.tableau} style={{ marginTop: "var(--espace-2)" }}>
                <thead>
                  <tr>
                    <th>{t("inst_colPeriode")}</th>
                    <th>{t("credit_echeancierInterets")}</th>
                    <th>{t("credit_echeancierCapital")}</th>
                  </tr>
                </thead>
                <tbody>
                  {echeancesVisibles[p.id].map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.periodDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</td>
                      <td className="chiffre">{formatMoney(e.interet, p.devise)}</td>
                      <td className="chiffre">{formatMoney(e.capital, p.devise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      ) : null}
    </div>
  );
}

export default function PretsPage() {
  return (
    <InstitutionShell>
      <PretsContenu />
    </InstitutionShell>
  );
}
