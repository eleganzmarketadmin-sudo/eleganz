"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Immobilisations et amortissements d'ELEGANZ elle-même (18 oct. 2026,
// audit du 18 oct. 2026, point 6 : "Trésorerie multi-comptes et
// immobilisations plateforme absentes") — pendant plateforme de
// (gestion)/finance/immobilisations. Même amortissement linéaire,
// comptabilisé via AssetsService.runDepreciationForMonthPlatform (compte de
// contrepartie 2848, distinct du 2841 boutique — voir
// accounting-seed.service.ts). Comptabilisation d'un mois toujours une
// action explicite, jamais un scheduler automatique.
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

function ImmobilisationsPlateformeContenu() {
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
    setChargement(true);
    api
      .get<Asset[]>("/admin/finance/assets")
      .then(setActifs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  };

  useEffect(recharger, []);

  const creerActif = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post("/admin/finance/assets", {
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
    await api.post(`/admin/finance/assets/${assetId}/mise-au-rebut`, {});
    recharger();
  };

  const comptabiliserDotations = async () => {
    setErreur(null);
    setResultatsDotation(null);
    try {
      const resultats = await api.post<ResultatDotation[]>(
        `/admin/finance/assets/depreciation/run?period=${periode}`,
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
      <h1 className={styles.titre}>{t("admsim_titreImmobilisations")}</h1>
      <AdminFinanceSubNav />

      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("imm_noteAide")}
      </p>

      <h2>{t("imm_nouvelleImmobilisation")}</h2>
      <form onSubmit={creerActif} style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("imm_libelle")}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("imm_placeholderLibelle")} required style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("imm_dateAcquisition")}</label>
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} required style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("imm_coutUsd")}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            required
            style={{ minHeight: 40, padding: 8 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("imm_dureeAmortissement")}</label>
          <input
            type="number"
            min="1"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            required
            style={{ minHeight: 40, padding: 8 }}
          />
        </div>
        <button type="submit" className={styles.bouton}>
          {t("imm_enregistrerImmobilisation")}
        </button>
      </form>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.message}>{confirmation}</div>}

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", margin: "24px 0" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("imm_comptabiliserDotationsMois")}</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("imm_libelle")}</th>
              <th style={{ textAlign: "left" }}>{t("imm_colAcquisition")}</th>
              <th style={{ textAlign: "right" }}>{t("imm_colCout")}</th>
              <th style={{ textAlign: "left" }}>{t("imm_colDuree")}</th>
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
                      <button
                        type="button"
                        onClick={() => miseAuRebut(a.id)}
                        style={{ border: "1px solid var(--color-flamme)", background: "var(--color-surface)", color: "var(--color-flamme)", padding: "4px 10px", minHeight: 32, cursor: "pointer", fontSize: "0.8125rem" }}
                      >
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

export default function AdminImmobilisationsPage() {
  return (
    <AdminShell>
      <ImmobilisationsPlateformeContenu />
    </AdminShell>
  );
}
