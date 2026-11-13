"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Règles fiscales applicables à ELEGANZ (prompt du 13 oct. 2026, §14) —
// scope=PLATFORM, strictement indépendant des règles fiscales de chaque
// boutique (scope=SHOP) : cette page n'appelle jamais une route boutique,
// et les routes /admin/finance/fiscal-rules ne retournent jamais de règle
// de boutique (séparation imposée côté API — voir
// docs/ARCHITECTURE_FINANCE.md §3.2).

interface RegleFiscale {
  id: string;
  label: string;
  category: "TVA" | "IMPOT" | "RETENUE" | "CONTRIBUTION" | "AUTRE";
  rateOrFormula: string;
  baseCalcul: string | null;
  sourceReference: string | null;
  effectiveFrom: string;
  status: "PROPOSEE" | "CONFIGUREE" | "VERIFIEE" | "OBSOLETE";
}

const CLES_STATUT: Record<RegleFiscale["status"], string> = {
  PROPOSEE: "rfi_statutProposee",
  CONFIGUREE: "admrfi_statutConfiguree",
  VERIFIEE: "admrfi_statutVerifiee",
  OBSOLETE: "rfi_statutObsolete",
};

const CLES_CATEGORIE: Record<RegleFiscale["category"], string> = {
  TVA: "rfi_catTva",
  IMPOT: "rfi_catImpot",
  RETENUE: "rfi_catRetenue",
  CONTRIBUTION: "rfi_catContribution",
  AUTRE: "rfi_catAutre",
};

function ReglesFiscalesAdminContenu() {
  const { t } = useLocale();
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<RegleFiscale["category"]>("TVA");
  const [rateOrFormula, setRateOrFormula] = useState("");
  // baseCalcul/sourceReference (18 oct. 2026, audit du 18 oct. 2026, point
  // 4) — jusqu'ici omis du formulaire plateforme alors qu'ils existent
  // depuis le départ côté boutique (voir (gestion)/finance/regles-fiscales).
  const [baseCalcul, setBaseCalcul] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  // Modification d'une règle existante (13 nov. 2026, signalement : "on n'a
  // pas la possibilité de modifier les règles après leur ajout") — jusqu'ici
  // ce formulaire ne servait qu'à créer ; `editingId` bascule le même
  // formulaire en mode édition (préremplissage + appel PATCH au lieu de
  // POST), sans dupliquer les champs.
  const [editingId, setEditingId] = useState<string | null>(null);

  function recharger() {
    setChargement(true);
    api
      .get<RegleFiscale[]>("/admin/finance/fiscal-rules")
      .then(setRegles)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  function resetFormulaire() {
    setEditingId(null);
    setLabel("");
    setCategory("TVA");
    setRateOrFormula("");
    setBaseCalcul("");
    setSourceReference("");
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setMotif("");
  }

  function demarrerModification(r: RegleFiscale) {
    setEditingId(r.id);
    setLabel(r.label);
    setCategory(r.category);
    setRateOrFormula(r.rateOrFormula);
    setBaseCalcul(r.baseCalcul ?? "");
    setSourceReference(r.sourceReference ?? "");
    setEffectiveFrom(r.effectiveFrom.slice(0, 10));
    // Motif volontairement vide : la raison de la MODIFICATION n'est pas
    // celle, déjà enregistrée, de la création d'origine.
    setMotif("");
    setMessage(null);
    setErreur(null);
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !rateOrFormula || !motif) return;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    const champs = {
      label,
      category,
      rateOrFormula,
      baseCalcul: baseCalcul || undefined,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      sourceReference: sourceReference || undefined,
      motif,
    };
    try {
      if (editingId) {
        await api.patch(`/admin/finance/fiscal-rules/${editingId}`, champs);
        setMessage(t("admrfi_regleModifiee"));
      } else {
        await api.post("/admin/finance/fiscal-rules", champs);
        setMessage(t("admrfi_regleEnregistree"));
      }
      resetFormulaire();
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  // Archivage (18 oct. 2026, audit du 18 oct. 2026, point 4) — jusqu'ici
  // absent côté plateforme : une règle obsolète restait affichée comme
  // active indéfiniment, sans aucun moyen de la retirer avec un motif tracé.
  async function archiver(regleId: string) {
    const motifArchivage = window.prompt(t("rfi_promptMotifArchivage"));
    if (!motifArchivage) return;
    try {
      await api.delete(`/admin/finance/fiscal-rules/${regleId}`, { motif: motifArchivage });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rfi_archivageImpossible"));
    }
  }

  // Réactivation (13 nov. 2026, même signalement que ci-dessus) — l'archivage
  // était jusqu'ici un aller sans retour depuis cet écran.
  async function reactiver(regleId: string) {
    const motifReactivation = window.prompt(t("rfi_promptMotifReactivation"));
    if (!motifReactivation) return;
    try {
      await api.post(`/admin/finance/fiscal-rules/${regleId}/reactivate`, { motif: motifReactivation });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("rfi_reactivationImpossible"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admrfi_titre")}</h1>
      <AdminFinanceSubNav />
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
        {t("admrfi_description")}
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {message && <div className={styles.message}>{message}</div>}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : (
        <>
          <form onSubmit={soumettre} style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
            <input placeholder={t("rfi_intitule")} value={label} onChange={(e) => setLabel(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <select value={category} onChange={(e) => setCategory(e.target.value as RegleFiscale["category"])} style={{ minHeight: 40 }}>
              <option value="TVA">{t("rfi_catTva")}</option>
              <option value="IMPOT">{t("rfi_catImpot")}</option>
              <option value="RETENUE">{t("rfi_catRetenue")}</option>
              <option value="CONTRIBUTION">{t("rfi_catContribution")}</option>
              <option value="AUTRE">{t("rfi_catAutre")}</option>
            </select>
            <input placeholder={t("rfi_tauxOuFormule")} value={rateOrFormula} onChange={(e) => setRateOrFormula(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input placeholder={t("rfi_baseCalcul")} value={baseCalcul} onChange={(e) => setBaseCalcul(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input placeholder={t("rfi_sourceReglementaire")} value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input
              placeholder={editingId ? t("rfi_placeholderMotifModification") : t("admrfi_placeholderMotif")}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              style={{ minHeight: 40, padding: 8 }}
            />
            <button className={styles.boutonVerif} type="submit" disabled={enCours || !label || !rateOrFormula || !motif}>
              {enCours
                ? t("cha_enregistrementEnCours")
                : editingId
                  ? t("rfi_enregistrerModifications")
                  : t("admrfi_ajouter")}
            </button>
            {editingId && (
              <button type="button" className={styles.boutonSecondaire} onClick={resetFormulaire}>
                {t("rfi_annulerModification")}
              </button>
            )}
          </form>

          {regles.length === 0 ? (
            <p>{t("rfi_aucuneRegle")}</p>
          ) : (
            <div className={styles.tableauScroll}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{t("rfi_intitule")}</th>
                  <th style={{ textAlign: "left" }}>{t("cat_categorie")}</th>
                  <th style={{ textAlign: "left" }}>{t("rfi_colTauxFormule")}</th>
                  <th style={{ textAlign: "left" }}>{t("rfi_colDepuis")}</th>
                  <th style={{ textAlign: "left" }}>{t("rfi_colStatut")}</th>
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
                      {r.status !== "OBSOLETE" ? (
                        <>
                          <button className={styles.modifier} onClick={() => demarrerModification(r)}>
                            {t("rfi_modifier")}
                          </button>
                          <button className={styles.retirer} onClick={() => archiver(r.id)}>
                            {t("rfi_archiver")}
                          </button>
                        </>
                      ) : (
                        <button className={styles.reactiver} onClick={() => reactiver(r.id)}>
                          {t("rfi_reactiver")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReglesFiscalesAdminPage() {
  return (
    <AdminShell>
      <ReglesFiscalesAdminContenu />
    </AdminShell>
  );
}
