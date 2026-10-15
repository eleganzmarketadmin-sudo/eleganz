"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Règles fiscales applicables à la boutique (prompt du 13 oct. 2026, §5) —
// bibliothèque versionnée, jamais appliquée automatiquement. La fonction de
// simulation (§5.8) et la vérification professionnelle réelle (§5.5) ne
// sont volontairement PAS construites à cette phase (voir
// docs/ARCHITECTURE_FINANCE.md §7) : l'écran le dit explicitement plutôt
// que de simuler un résultat inventé.

interface IdentiteFiscale {
  fiscalLegalName: string | null;
  fiscalLegalForm: string | null;
  fiscalIdNumber: string | null;
  fiscalAddress: string | null;
  fiscalJurisdiction: string | null;
  fiscalRegime: string | null;
  fiscalExercice: string | null;
  fiscalVatRegistered: boolean;
}

interface RegleFiscale {
  id: string;
  label: string;
  category: "TVA" | "IMPOT" | "RETENUE" | "CONTRIBUTION" | "AUTRE";
  rateOrFormula: string;
  baseCalcul: string | null;
  champApplication: string | null;
  regime: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceReference: string | null;
  status: "PROPOSEE" | "CONFIGUREE" | "VERIFIEE" | "OBSOLETE";
  createdAt: string;
}

const CLES_STATUT: Record<RegleFiscale["status"], string> = {
  PROPOSEE: "rfi_statutProposee",
  CONFIGUREE: "rfi_statutConfiguree",
  VERIFIEE: "rfi_statutVerifiee",
  OBSOLETE: "rfi_statutObsolete",
};

const CLES_CATEGORIE: Record<RegleFiscale["category"], string> = {
  TVA: "rfi_catTva",
  IMPOT: "rfi_catImpot",
  RETENUE: "rfi_catRetenue",
  CONTRIBUTION: "rfi_catContribution",
  AUTRE: "rfi_catAutre",
};

function ReglesFiscalesContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [identite, setIdentite] = useState<IdentiteFiscale | null>(null);
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<RegleFiscale["category"]>("TVA");
  const [rateOrFormula, setRateOrFormula] = useState("");
  const [baseCalcul, setBaseCalcul] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceReference, setSourceReference] = useState("");
  const [motif, setMotif] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    Promise.all([
      api.get<IdentiteFiscale>(`/shops/${currentShop.id}/finance/fiscal-identity`),
      api.get<RegleFiscale[]>(`/shops/${currentShop.id}/finance/fiscal-rules`),
    ])
      .then(([id, r]) => {
        setIdentite(id);
        setRegles(r);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function enregistrerIdentite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentShop) return;
    const form = new FormData(e.currentTarget);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch(`/shops/${currentShop.id}/finance/fiscal-identity`, {
        fiscalLegalName: (form.get("fiscalLegalName") as string) || undefined,
        fiscalLegalForm: (form.get("fiscalLegalForm") as string) || undefined,
        fiscalIdNumber: (form.get("fiscalIdNumber") as string) || undefined,
        fiscalAddress: (form.get("fiscalAddress") as string) || undefined,
        fiscalJurisdiction: (form.get("fiscalJurisdiction") as string) || undefined,
        fiscalRegime: (form.get("fiscalRegime") as string) || undefined,
        fiscalExercice: (form.get("fiscalExercice") as string) || undefined,
        fiscalVatRegistered: form.get("fiscalVatRegistered") === "on",
      });
      setConfirmation(t("rfi_infosEnregistrees"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    }
  }

  async function creerRegle(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop || !label || !rateOrFormula || !motif) return;
    setEnregistrementEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/finance/fiscal-rules`, {
        label,
        category,
        rateOrFormula,
        baseCalcul: baseCalcul || undefined,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        sourceReference: sourceReference || undefined,
        motif,
      });
      setLabel("");
      setRateOrFormula("");
      setBaseCalcul("");
      setSourceReference("");
      setMotif("");
      setConfirmation(t("rfi_regleEnregistree"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function archiver(regleId: string) {
    if (!currentShop) return;
    const motifArchivage = window.prompt(t("rfi_promptMotifArchivage"));
    if (!motifArchivage) return;
    try {
      await api.delete(`/shops/${currentShop.id}/finance/fiscal-rules/${regleId}`, { motif: motifArchivage });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rfi_archivageImpossible"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("fin_titre")}</h1>
      <FinanceSubNav />
      <h2 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>{t("rfi_titreSection")}</h2>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "20px" }}>
        {t("rfi_noteAide")}
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : (
        <>
          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>{t("rfi_infosEntreprise")}</h3>
          <form className={styles.formulaire} onSubmit={enregistrerIdentite} style={{ marginBottom: "32px" }}>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalName">{t("rfi_denomination")}</label>
              <input id="fiscalLegalName" name="fiscalLegalName" defaultValue={identite?.fiscalLegalName ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalForm">{t("rfi_formeJuridique")}</label>
              <input id="fiscalLegalForm" name="fiscalLegalForm" defaultValue={identite?.fiscalLegalForm ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalIdNumber">{t("rfi_numeroIdFiscal")}</label>
              <input id="fiscalIdNumber" name="fiscalIdNumber" defaultValue={identite?.fiscalIdNumber ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalAddress">{t("rfi_adresseFiscale")}</label>
              <input id="fiscalAddress" name="fiscalAddress" defaultValue={identite?.fiscalAddress ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalJurisdiction">{t("rfi_juridictionFiscale")}</label>
              <input id="fiscalJurisdiction" name="fiscalJurisdiction" defaultValue={identite?.fiscalJurisdiction ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalRegime">{t("rfi_regimeDeclare")}</label>
              <input id="fiscalRegime" name="fiscalRegime" defaultValue={identite?.fiscalRegime ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalExercice">{t("rfi_exerciceComptable")}</label>
              <input id="fiscalExercice" name="fiscalExercice" placeholder="01/01-31/12" defaultValue={identite?.fiscalExercice ?? ""} />
            </div>
            <div className={styles.champ} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input id="fiscalVatRegistered" name="fiscalVatRegistered" type="checkbox" defaultChecked={identite?.fiscalVatRegistered ?? false} />
              <label htmlFor="fiscalVatRegistered">{t("rfi_assujettieTva")}</label>
            </div>
            <button className={styles.bouton} type="submit">
              {t("rfi_enregistrerInfos")}
            </button>
          </form>

          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>{t("rfi_nouvelleRegle")}</h3>
          <form className={styles.formulaire} onSubmit={creerRegle} style={{ marginBottom: "24px" }}>
            <div className={styles.champ}>
              <label htmlFor="label">{t("rfi_intitule")}</label>
              <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("rfi_placeholderIntitule")} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="category">{t("cat_categorie")}</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value as RegleFiscale["category"])}>
                {(Object.keys(CLES_CATEGORIE) as RegleFiscale["category"][]).map((c) => (
                  <option key={c} value={c}>
                    {t(CLES_CATEGORIE[c])}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.champ}>
              <label htmlFor="rateOrFormula">{t("rfi_tauxOuFormule")}</label>
              <input id="rateOrFormula" value={rateOrFormula} onChange={(e) => setRateOrFormula(e.target.value)} placeholder="Ex. 16%" />
            </div>
            <div className={styles.champ}>
              <label htmlFor="baseCalcul">{t("rfi_baseCalcul")}</label>
              <input id="baseCalcul" value={baseCalcul} onChange={(e) => setBaseCalcul(e.target.value)} placeholder={t("rfi_placeholderBaseCalcul")} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="effectiveFrom">{t("rfi_dateDebut")}</label>
              <input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="sourceReference">{t("rfi_sourceReglementaire")}</label>
              <input id="sourceReference" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="motif">{t("rfi_motifRegle")}</label>
              <input id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t("rfi_placeholderMotif")} />
            </div>
            <button className={styles.bouton} type="submit" disabled={enregistrementEnCours || !label || !rateOrFormula || !motif}>
              {enregistrementEnCours ? t("cha_enregistrementEnCours") : t("rfi_ajouterRegle")}
            </button>
          </form>

          {regles.length === 0 ? (
            <p>{t("rfi_aucuneRegle")}</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{t("rfi_intitule")}</th>
                  <th>{t("cat_categorie")}</th>
                  <th>{t("rfi_colTauxFormule")}</th>
                  <th>{t("rfi_colDepuis")}</th>
                  <th>{t("rfi_colStatut")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {regles.map((r) => (
                  <tr key={r.id} style={{ opacity: r.status === "OBSOLETE" ? 0.5 : 1 }}>
                    <td>{r.label}</td>
                    <td>{t(CLES_CATEGORIE[r.category])}</td>
                    <td>{r.rateOrFormula}</td>
                    <td>{new Date(r.effectiveFrom).toLocaleDateString("fr-FR")}</td>
                    <td>{t(CLES_STATUT[r.status])}</td>
                    <td>
                      {r.status !== "OBSOLETE" && (
                        <button className={styles.retirer} onClick={() => archiver(r.id)}>
                          {t("rfi_archiver")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "16px" }}>
            {t("rfi_noteVerificationIndisponible")}
          </p>
        </>
      )}
    </div>
  );
}

export default function ReglesFiscalesPage() {
  return (
    <ProtectedGestionPage>
      <ReglesFiscalesContent />
    </ProtectedGestionPage>
  );
}
