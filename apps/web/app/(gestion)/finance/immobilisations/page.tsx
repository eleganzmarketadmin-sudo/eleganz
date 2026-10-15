"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Immobilisations et amortissements (13 oct. 2026, Finance & Comptabilité
// Phase 4) — voir docs/ARCHITECTURE_FINANCE.md §8quater. Amortissement
// linéaire uniquement. La comptabilisation d'un mois est une action
// explicite (bouton ci-dessous), jamais automatique : aucun scheduler
// serveur ne tourne en tâche de fond à cette phase.
interface Depreciation {
  id: string;
  periodDate: string;
  amount: string;
}

interface Asset {
  id: string;
  label: string;
  acquisitionDate: string;
  acquisitionCost: string;
  durationMonths: number;
  disposed: boolean;
  depreciations: Depreciation[];
}

interface ResultatDotation {
  assetId: string;
  label: string;
  montant: number;
  statut: "comptabilise" | "deja_comptabilise" | "termine";
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cumulAmorti(actif: Asset): number {
  return actif.depreciations.reduce((s, d) => s + Number(d.amount), 0);
}

function AmortissementsContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [actifs, setActifs] = useState<Asset[] | null>(null);
  const [label, setLabel] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [durationMonths, setDurationMonths] = useState("36");
  const [periode, setPeriode] = useState(moisCourant());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [resultatsDotation, setResultatsDotation] = useState<ResultatDotation[] | null>(null);

  const recharger = () => {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Asset[]>(`/shops/${currentShop.id}/assets`)
      .then(setActifs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  };

  useEffect(recharger, [currentShop]);

  const creerActif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/assets`, {
        label,
        acquisitionDate,
        acquisitionCost: Number(acquisitionCost),
        durationMonths: Number(durationMonths),
      });
      setLabel("");
      setAcquisitionCost("");
      setConfirmation(t("imm_immobilisationEnregistree"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    }
  };

  const miseAuRebut = async (assetId: string) => {
    if (!currentShop) return;
    await api.post(`/shops/${currentShop.id}/assets/${assetId}/mise-au-rebut`, {});
    recharger();
  };

  const comptabiliserDotations = async () => {
    if (!currentShop) return;
    setErreur(null);
    setResultatsDotation(null);
    try {
      const resultats = await api.post<ResultatDotation[]>(
        `/shops/${currentShop.id}/assets/depreciation/run?period=${periode}`,
        {},
      );
      setResultatsDotation(resultats);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique"));
    }
  };

  return (
    <div>
      <h1 className={styles.titre}>{t("fin_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("imm_noteAide")}
      </p>

      <h2>{t("imm_nouvelleImmobilisation")}</h2>
      <form onSubmit={creerActif} className={styles.formulaire}>
        <div className={styles.champ}>
          <label>{t("imm_libelle")}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("imm_placeholderLibelle")} required />
        </div>
        <div className={styles.champ}>
          <label>{t("imm_dateAcquisition")}</label>
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} required />
        </div>
        <div className={styles.champ}>
          <label>{t("imm_coutUsd")}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            required
          />
        </div>
        <div className={styles.champ}>
          <label>{t("imm_dureeAmortissement")}</label>
          <input
            type="number"
            min="1"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.bouton}>
          {t("imm_enregistrerImmobilisation")}
        </button>
      </form>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", margin: "24px 0" }}>
        <div className={styles.champ}>
          <label>{t("imm_comptabiliserDotationsMois")}</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} />
        </div>
        <button type="button" className={styles.bouton} onClick={comptabiliserDotations}>
          {t("imm_comptabiliserDotations")}
        </button>
      </div>

      {resultatsDotation && (
        <ul style={{ marginBottom: "20px" }}>
          {resultatsDotation.map((r) => (
            <li key={r.assetId}>
              {r.label} :{" "}
              {r.statut === "comptabilise"
                ? `${t("imm_dotationDe")} ${f(r.montant)} $ ${t("imm_comptabilisee")}`
                : r.statut === "deja_comptabilise"
                ? t("imm_dejaComptabiliseeMois")
                : t("imm_dureeDejaEcoulee")}
            </li>
          ))}
        </ul>
      )}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !actifs || actifs.length === 0 ? (
        <p>{t("imm_aucuneImmobilisation")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("imm_libelle")}</th>
              <th>{t("imm_colAcquisition")}</th>
              <th style={{ textAlign: "right" }}>{t("imm_colCout")}</th>
              <th>{t("imm_colDuree")}</th>
              <th style={{ textAlign: "right" }}>{t("imm_colAmortiACeJour")}</th>
              <th style={{ textAlign: "right" }}>{t("imm_colValeurNette")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((a) => {
              const amorti = cumulAmorti(a);
              const valeurNette = Number(a.acquisitionCost) - amorti;
              return (
                <tr key={a.id} style={{ opacity: a.disposed ? 0.5 : 1 }}>
                  <td>
                    {a.label}
                    {a.disposed ? ` (${t("imm_misAuRebutParenthese")})` : ""}
                  </td>
                  <td>{new Date(a.acquisitionDate).toLocaleDateString("fr-FR")}</td>
                  <td style={{ textAlign: "right" }}>{f(a.acquisitionCost)} $</td>
                  <td>{a.durationMonths} {t("imm_mois")}</td>
                  <td style={{ textAlign: "right" }}>{f(amorti)} $</td>
                  <td style={{ textAlign: "right" }}>{f(valeurNette)} $</td>
                  <td>
                    {!a.disposed && (
                      <button type="button" className={styles.retirer} onClick={() => miseAuRebut(a.id)}>
                        {t("imm_mettreAuRebut")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ImmobilisationsPage() {
  return (
    <ProtectedGestionPage>
      <AmortissementsContenu />
    </ProtectedGestionPage>
  );
}
