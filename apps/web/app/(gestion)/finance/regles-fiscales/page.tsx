"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
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

const LABELS_STATUT: Record<RegleFiscale["status"], string> = {
  PROPOSEE: "Proposée",
  CONFIGUREE: "Configurée par l'entreprise",
  VERIFIEE: "Vérifiée par un professionnel",
  OBSOLETE: "Obsolète",
};

const LABELS_CATEGORIE: Record<RegleFiscale["category"], string> = {
  TVA: "TVA",
  IMPOT: "Impôt",
  RETENUE: "Retenue",
  CONTRIBUTION: "Contribution",
  AUTRE: "Autre",
};

function ReglesFiscalesContent() {
  const { currentShop } = useShop();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
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
      setConfirmation("Informations fiscales enregistrées.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
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
      setConfirmation("Règle fiscale enregistrée — statut « Configurée par l'entreprise ».");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function archiver(regleId: string) {
    if (!currentShop) return;
    const motifArchivage = window.prompt("Motif de l'archivage de cette règle ?");
    if (!motifArchivage) return;
    try {
      await api.delete(`/shops/${currentShop.id}/finance/fiscal-rules/${regleId}`, { motif: motifArchivage });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Archivage impossible.");
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />
      <h2 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>Règles fiscales applicables à la boutique</h2>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "20px" }}>
        Ces paramètres doivent être confirmés en fonction de votre situation
        réelle. Leur enregistrement ici ne constitue ni une homologation ni
        une validation officielle — voir le statut de chaque règle.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      {chargement ? (
        <p>Chargement…</p>
      ) : (
        <>
          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Informations fiscales de l&apos;entreprise</h3>
          <form className={styles.formulaire} onSubmit={enregistrerIdentite} style={{ marginBottom: "32px" }}>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalName">Dénomination</label>
              <input id="fiscalLegalName" name="fiscalLegalName" defaultValue={identite?.fiscalLegalName ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalForm">Forme juridique</label>
              <input id="fiscalLegalForm" name="fiscalLegalForm" defaultValue={identite?.fiscalLegalForm ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalIdNumber">Numéro d&apos;identification fiscale</label>
              <input id="fiscalIdNumber" name="fiscalIdNumber" defaultValue={identite?.fiscalIdNumber ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalAddress">Adresse fiscale</label>
              <input id="fiscalAddress" name="fiscalAddress" defaultValue={identite?.fiscalAddress ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalJurisdiction">Juridiction fiscale</label>
              <input id="fiscalJurisdiction" name="fiscalJurisdiction" defaultValue={identite?.fiscalJurisdiction ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalRegime">Régime d&apos;imposition déclaré</label>
              <input id="fiscalRegime" name="fiscalRegime" defaultValue={identite?.fiscalRegime ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalExercice">Exercice comptable</label>
              <input id="fiscalExercice" name="fiscalExercice" placeholder="01/01-31/12" defaultValue={identite?.fiscalExercice ?? ""} />
            </div>
            <div className={styles.champ} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input id="fiscalVatRegistered" name="fiscalVatRegistered" type="checkbox" defaultChecked={identite?.fiscalVatRegistered ?? false} />
              <label htmlFor="fiscalVatRegistered">Assujettie à la TVA</label>
            </div>
            <button className={styles.bouton} type="submit">
              Enregistrer les informations
            </button>
          </form>

          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Nouvelle règle</h3>
          <form className={styles.formulaire} onSubmit={creerRegle} style={{ marginBottom: "24px" }}>
            <div className={styles.champ}>
              <label htmlFor="label">Intitulé</label>
              <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. TVA sur ventes" />
            </div>
            <div className={styles.champ}>
              <label htmlFor="category">Catégorie</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value as RegleFiscale["category"])}>
                {(Object.keys(LABELS_CATEGORIE) as RegleFiscale["category"][]).map((c) => (
                  <option key={c} value={c}>
                    {LABELS_CATEGORIE[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.champ}>
              <label htmlFor="rateOrFormula">Taux ou formule</label>
              <input id="rateOrFormula" value={rateOrFormula} onChange={(e) => setRateOrFormula(e.target.value)} placeholder="Ex. 16%" />
            </div>
            <div className={styles.champ}>
              <label htmlFor="baseCalcul">Base de calcul (facultatif)</label>
              <input id="baseCalcul" value={baseCalcul} onChange={(e) => setBaseCalcul(e.target.value)} placeholder="Ex. prix de vente HT" />
            </div>
            <div className={styles.champ}>
              <label htmlFor="effectiveFrom">Date de début</label>
              <input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="sourceReference">Source réglementaire (facultatif)</label>
              <input id="sourceReference" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="motif">Motif de cette règle</label>
              <input id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Pourquoi cette règle ?" />
            </div>
            <button className={styles.bouton} type="submit" disabled={enregistrementEnCours || !label || !rateOrFormula || !motif}>
              {enregistrementEnCours ? "Enregistrement…" : "Ajouter la règle"}
            </button>
          </form>

          {regles.length === 0 ? (
            <p>Aucune règle fiscale enregistrée pour l&apos;instant.</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Intitulé</th>
                  <th>Catégorie</th>
                  <th>Taux / formule</th>
                  <th>Depuis</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {regles.map((r) => (
                  <tr key={r.id} style={{ opacity: r.status === "OBSOLETE" ? 0.5 : 1 }}>
                    <td>{r.label}</td>
                    <td>{LABELS_CATEGORIE[r.category]}</td>
                    <td>{r.rateOrFormula}</td>
                    <td>{new Date(r.effectiveFrom).toLocaleDateString("fr-FR")}</td>
                    <td>{LABELS_STATUT[r.status]}</td>
                    <td>
                      {r.status !== "OBSOLETE" && (
                        <button className={styles.retirer} onClick={() => archiver(r.id)}>
                          Archiver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "16px" }}>
            La vérification par un comptable ou conseiller fiscal externe et
            la simulation d&apos;impact d&apos;une modification ne sont pas
            encore disponibles dans cet écran.
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
