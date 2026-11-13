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

interface Tranche {
  min: number;
  max: number | null;
  taux: number;
}

interface RegleFiscale {
  id: string;
  label: string;
  category: "TVA" | "IMPOT" | "RETENUE" | "CONTRIBUTION" | "AUTRE";
  rateOrFormula: string;
  baseCalcul: string | null;
  sourceReference: string | null;
  effectiveFrom: string;
  status: "PROPOSEE" | "CONFIGUREE" | "VERIFIEE" | "OBSOLETE";
  // Barème par tranches (13 nov. 2026, signalement point 3) — voir
  // FiscalRuleTrancheMode dans schema.prisma. `null`/absent = règle à taux
  // simple, comportement inchangé pour toute règle créée avant ce champ.
  trancheMode?: "PALIER" | "PROGRESSIF" | null;
  tranches?: Tranche[] | null;
  trancheReferenceValeur?: string | number | null;
  trancheReferenceLabel?: string | null;
}

// Une ligne de tranche dans le formulaire — champs texte (contrôlés),
// convertis en nombre seulement à la soumission.
interface TrancheFormulaire {
  min: string;
  max: string;
  taux: string;
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

  // Barème par tranches (13 nov. 2026, signalement point 3 : "rendre
  // possible les réajustements de plage de taux à partir du centre de
  // pilotage") — panneau optionnel du même formulaire, jamais un second
  // formulaire séparé.
  const [trancheActif, setTrancheActif] = useState(false);
  const [trancheMode, setTrancheMode] = useState<"PALIER" | "PROGRESSIF">("PALIER");
  const [trancheReferenceLabel, setTrancheReferenceLabel] = useState("");
  const [trancheReferenceValeur, setTrancheReferenceValeur] = useState("");
  const [tranches, setTranches] = useState<TrancheFormulaire[]>([{ min: "", max: "", taux: "" }]);

  function ajouterTranche() {
    setTranches((ts) => [...ts, { min: "", max: "", taux: "" }]);
  }

  function retirerTranche(index: number) {
    setTranches((ts) => ts.filter((_, i) => i !== index));
  }

  function modifierTranche(index: number, champ: keyof TrancheFormulaire, valeur: string) {
    setTranches((ts) => ts.map((t, i) => (i === index ? { ...t, [champ]: valeur } : t)));
  }

  function resetTranches() {
    setTrancheActif(false);
    setTrancheMode("PALIER");
    setTrancheReferenceLabel("");
    setTrancheReferenceValeur("");
    setTranches([{ min: "", max: "", taux: "" }]);
  }

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
    resetTranches();
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

    if (r.trancheMode && r.tranches && r.tranches.length > 0) {
      setTrancheActif(true);
      setTrancheMode(r.trancheMode);
      setTrancheReferenceLabel(r.trancheReferenceLabel ?? "");
      setTrancheReferenceValeur(r.trancheReferenceValeur != null ? String(r.trancheReferenceValeur) : "");
      setTranches(
        r.tranches.map((t) => ({
          min: String(t.min),
          max: t.max != null ? String(t.max) : "",
          taux: String(t.taux),
        })),
      );
    } else {
      resetTranches();
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !rateOrFormula || !motif) return;
    setEnCours(true);
    setErreur(null);
    setMessage(null);

    // Barème — n'envoie des tranches que si le panneau est actif et qu'au
    // moins une ligne a ses 2 champs requis (min, taux) remplis ; sinon
    // envoie des `null` explicites pour effacer un barème précédemment
    // configuré (une modification peut aussi bien désactiver un barème).
    const trancheLignesValides = tranches
      .filter((t) => t.min.trim() !== "" && t.taux.trim() !== "")
      .map((t) => ({
        min: Number(t.min),
        max: t.max.trim() === "" ? undefined : Number(t.max),
        taux: Number(t.taux),
      }));
    const champsBareme =
      trancheActif && trancheLignesValides.length > 0
        ? {
            trancheMode,
            tranches: trancheLignesValides,
            trancheReferenceValeur:
              trancheMode === "PALIER" && trancheReferenceValeur.trim() !== ""
                ? Number(trancheReferenceValeur)
                : undefined,
            trancheReferenceLabel: trancheMode === "PALIER" ? trancheReferenceLabel || undefined : undefined,
          }
        : { trancheMode: null, tranches: null, trancheReferenceValeur: null, trancheReferenceLabel: null };

    const champs = {
      label,
      category,
      rateOrFormula,
      baseCalcul: baseCalcul || undefined,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      sourceReference: sourceReference || undefined,
      ...champsBareme,
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

            <div style={{ width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: "10px 12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                <input type="checkbox" checked={trancheActif} onChange={(e) => setTrancheActif(e.target.checked)} />
                {t("rfi_baremeActif")}
              </label>

              {trancheActif && (
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}>{t("rfi_baremeMode")}</label>
                    <select value={trancheMode} onChange={(e) => setTrancheMode(e.target.value as "PALIER" | "PROGRESSIF")} style={{ minHeight: 36 }}>
                      <option value="PALIER">{t("rfi_baremeModePalier")}</option>
                      <option value="PROGRESSIF">{t("rfi_baremeModeProgressif")}</option>
                    </select>
                    <p style={{ fontSize: "0.8rem", color: "var(--color-texte-muted)", marginTop: 4 }}>
                      {trancheMode === "PALIER" ? t("rfi_baremeNotePalier") : t("rfi_baremeNoteProgressif")}
                    </p>
                  </div>

                  {trancheMode === "PALIER" && (
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <input
                        placeholder={t("rfi_baremeReferenceLabelPlaceholder")}
                        value={trancheReferenceLabel}
                        onChange={(e) => setTrancheReferenceLabel(e.target.value)}
                        style={{ minHeight: 36, padding: 8, minWidth: 260 }}
                      />
                      <input
                        type="number"
                        placeholder={t("rfi_baremeReferenceValeur")}
                        value={trancheReferenceValeur}
                        onChange={(e) => setTrancheReferenceValeur(e.target.value)}
                        style={{ minHeight: 36, padding: 8, width: 180 }}
                      />
                    </div>
                  )}

                  {tranches.map((tr, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="number"
                        placeholder={t("rfi_trancheDe")}
                        value={tr.min}
                        onChange={(e) => modifierTranche(i, "min", e.target.value)}
                        style={{ minHeight: 36, padding: 8, width: 150 }}
                      />
                      <input
                        type="number"
                        placeholder={t("rfi_trancheA")}
                        value={tr.max}
                        onChange={(e) => modifierTranche(i, "max", e.target.value)}
                        style={{ minHeight: 36, padding: 8, width: 170 }}
                      />
                      <input
                        type="number"
                        placeholder={t("rfi_trancheTaux")}
                        value={tr.taux}
                        onChange={(e) => modifierTranche(i, "taux", e.target.value)}
                        style={{ minHeight: 36, padding: 8, width: 100 }}
                      />
                      <button type="button" className={styles.retirer} onClick={() => retirerTranche(i)} disabled={tranches.length <= 1}>
                        {t("rfi_trancheRetirer")}
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={ajouterTranche} style={{ alignSelf: "flex-start" }}>
                    {t("rfi_trancheAjouter")}
                  </button>
                </div>
              )}
            </div>

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
                    <td>
                      {r.rateOrFormula}
                      {r.trancheMode && r.tranches && r.tranches.length > 0 && (
                        <>
                          {" "}
                          <span style={{ fontSize: "0.8rem", color: "var(--color-texte-muted)" }}>
                            ({r.trancheMode === "PALIER" ? "Palier" : "Progressif"}, {r.tranches.length})
                          </span>
                        </>
                      )}
                    </td>
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
