"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ComptableShell } from "../../ComptableShell";
import { api, ApiError } from "../../../lib/api";
import { formatMoney, formatDate } from "../../../lib/money";
import styles from "./page.module.css";

interface Activite {
  id: string;
  name: string;
  category: string;
}

interface Entree {
  id: string;
  date: string;
  direction: "ENTREE" | "SORTIE";
  category: string;
  currency: "CDF" | "USD";
  amount: string;
  note: string | null;
}

interface Dette {
  id: string;
  type: "DETTE" | "CREANCE" | "EMPRUNT";
  counterpartyName: string;
  description: string | null;
  amount: string;
  currency: "CDF" | "USD";
  dueDate: string | null;
  settled: boolean;
  totalPaye: number;
  solde: number;
}

const LABELS_TYPE_DETTE: Record<string, string> = {
  DETTE: "Dette (je dois payer)",
  CREANCE: "Créance (on me doit)",
  EMPRUNT: "Emprunt",
};

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

function ActiviteContenu({ activityId }: { activityId: string }) {
  const [activite, setActivite] = useState<Activite | null>(null);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [dettes, setDettes] = useState<Dette[]>([]);
  const [onglet, setOnglet] = useState<"carnet" | "dettes">("carnet");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Saisie rapide (prompt §5)
  const [date, setDate] = useState(aujourdHui());
  const [ventesCdf, setVentesCdf] = useState("");
  const [ventesUsd, setVentesUsd] = useState("");
  const [depensesCdf, setDepensesCdf] = useState("");
  const [depensesUsd, setDepensesUsd] = useState("");
  const [observation, setObservation] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Formulaire dette/créance
  const [formulaireDetteOuvert, setFormulaireDetteOuvert] = useState(false);
  const [typeDette, setTypeDette] = useState<"DETTE" | "CREANCE" | "EMPRUNT">("DETTE");
  const [nomContrepartie, setNomContrepartie] = useState("");
  const [montantDette, setMontantDette] = useState("");
  const [deviseDette, setDeviseDette] = useState<"CDF" | "USD">("USD");
  const [echeanceDette, setEcheanceDette] = useState("");

  function recharger() {
    Promise.all([
      api.get<Activite[]>("/comptable/activities"),
      api.get<Entree[]>(`/comptable/entries?activityId=${activityId}`),
      api.get<Dette[]>(`/comptable/debts?activityId=${activityId}`),
    ])
      .then(([activites, listeEntrees, listeDettes]) => {
        setActivite(activites.find((a) => a.id === activityId) ?? null);
        setEntrees(listeEntrees);
        setDettes(listeDettes);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [activityId]);

  async function soumettreSaisieRapide(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    if (!ventesCdf && !ventesUsd && !depensesCdf && !depensesUsd) {
      setErreur("Indiquez au moins un montant.");
      return;
    }
    setEnCours(true);
    try {
      await api.post("/comptable/entries/quick", {
        activityId,
        date,
        salesCdf: ventesCdf ? Number(ventesCdf) : undefined,
        salesUsd: ventesUsd ? Number(ventesUsd) : undefined,
        expensesCdf: depensesCdf ? Number(depensesCdf) : undefined,
        expensesUsd: depensesUsd ? Number(depensesUsd) : undefined,
        note: observation.trim() || undefined,
      });
      setVentesCdf("");
      setVentesUsd("");
      setDepensesCdf("");
      setDepensesUsd("");
      setObservation("");
      setMessage("Saisie enregistrée.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function supprimerEntree(id: string) {
    setErreur(null);
    try {
      await api.delete(`/comptable/entries/${id}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  async function creerDette(e: React.FormEvent) {
    e.preventDefault();
    if (!nomContrepartie.trim() || !montantDette) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/debts", {
        activityId,
        type: typeDette,
        counterpartyName: nomContrepartie.trim(),
        amount: Number(montantDette),
        currency: deviseDette,
        dueDate: echeanceDette || undefined,
      });
      setNomContrepartie("");
      setMontantDette("");
      setEcheanceDette("");
      setFormulaireDetteOuvert(false);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function payerDette(detteId: string, solde: number) {
    const texte = window.prompt(`Montant réglé (solde restant : ${solde})`);
    if (!texte) return;
    const montant = Number(texte);
    if (!montant || montant <= 0) return;
    setErreur(null);
    try {
      await api.post(`/comptable/debts/${detteId}/payments`, { amount: montant });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Paiement impossible à enregistrer.");
    }
  }

  if (chargement) return <p>Chargement…</p>;
  if (!activite) return <p className={styles.erreur}>Activité introuvable.</p>;

  return (
    <div>
      <h1 className={styles.titre}>{activite.name}</h1>
      <p className={styles.sousTitre}>Carnet de gestion de cette activité.</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <form className={styles.saisieRapide} onSubmit={soumettreSaisieRapide}>
        <label className={styles.champ}>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Ventes du jour CDF</span>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={ventesCdf}
            onChange={(e) => setVentesCdf(e.target.value)}
          />
        </label>
        <label className={styles.champ}>
          <span>Ventes du jour USD</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={ventesUsd}
            onChange={(e) => setVentesUsd(e.target.value)}
          />
        </label>
        <label className={styles.champ}>
          <span>Dépenses CDF</span>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={depensesCdf}
            onChange={(e) => setDepensesCdf(e.target.value)}
          />
        </label>
        <label className={styles.champ}>
          <span>Dépenses USD</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={depensesUsd}
            onChange={(e) => setDepensesUsd(e.target.value)}
          />
        </label>
        <label className={styles.champLarge}>
          <span>Observation (facultative)</span>
          <input value={observation} onChange={(e) => setObservation(e.target.value)} />
        </label>
        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <div className={styles.onglets} style={{ marginTop: "32px" }}>
        <button
          className={`${styles.onglet} ${onglet === "carnet" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("carnet")}
        >
          Carnet
        </button>
        <button
          className={`${styles.onglet} ${onglet === "dettes" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("dettes")}
        >
          Dettes, créances, emprunts
        </button>
      </div>

      {onglet === "carnet" ? (
        <>
          <h2 className={styles.sectionTitre}>Opérations récentes</h2>
          {entrees.length === 0 ? (
            <p className={styles.messageVide}>Aucune opération enregistrée pour l&apos;instant.</p>
          ) : (
            entrees.map((e) => (
              <div
                className={`${styles.ligne} ${e.direction === "ENTREE" ? styles.ligneEntree : styles.ligneSortie}`}
                key={e.id}
              >
                <span>
                  {formatDate(e.date)} — {e.category.replace(/_/g, " ").toLowerCase()}
                  {e.note ? ` (${e.note})` : ""}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <strong>{formatMoney(Number(e.amount), e.currency)}</strong>
                  <button className={styles.boutonSecondaire} onClick={() => supprimerEntree(e.id)}>
                    Supprimer
                  </button>
                </span>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <h2 className={styles.sectionTitre}>Dettes, créances et emprunts</h2>
          {!formulaireDetteOuvert ? (
            <button className={styles.bouton} onClick={() => setFormulaireDetteOuvert(true)}>
              + Nouvel enregistrement
            </button>
          ) : (
            <form className={styles.formulaireDette} onSubmit={creerDette} style={{ marginTop: "16px" }}>
              <label className={styles.champ}>
                <span>Type</span>
                <select value={typeDette} onChange={(e) => setTypeDette(e.target.value as typeof typeDette)}>
                  <option value="DETTE">Dette (je dois payer)</option>
                  <option value="CREANCE">Créance (on me doit)</option>
                  <option value="EMPRUNT">Emprunt</option>
                </select>
              </label>
              <label className={styles.champLarge}>
                <span>Nom de la personne concernée</span>
                <input value={nomContrepartie} onChange={(e) => setNomContrepartie(e.target.value)} required />
              </label>
              <label className={styles.champ}>
                <span>Montant</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montantDette}
                  onChange={(e) => setMontantDette(e.target.value)}
                  required
                />
              </label>
              <label className={styles.champ}>
                <span>Devise</span>
                <select value={deviseDette} onChange={(e) => setDeviseDette(e.target.value as "CDF" | "USD")}>
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </label>
              <label className={styles.champ}>
                <span>Échéance (facultative)</span>
                <input type="date" value={echeanceDette} onChange={(e) => setEcheanceDette(e.target.value)} />
              </label>
              <button className={styles.bouton} type="submit" disabled={enCours}>
                Enregistrer
              </button>
              <button
                type="button"
                className={styles.boutonSecondaire}
                onClick={() => setFormulaireDetteOuvert(false)}
              >
                Annuler
              </button>
            </form>
          )}

          <div style={{ marginTop: "16px" }}>
            {dettes.length === 0 ? (
              <p className={styles.messageVide}>Rien d&apos;enregistré pour l&apos;instant.</p>
            ) : (
              dettes.map((d) => (
                <div
                  className={`${styles.ligne} ${
                    d.type === "DETTE" ? styles.ligneDette : d.type === "CREANCE" ? styles.ligneCreance : styles.ligneEmprunt
                  } ${d.settled ? styles.ligneSoldee : ""}`}
                  key={d.id}
                >
                  <span>
                    <strong>{LABELS_TYPE_DETTE[d.type]}</strong> — {d.counterpartyName}
                    {d.dueDate && ` · échéance ${formatDate(d.dueDate)}`}
                    {d.settled && " · soldé"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span>
                      Solde : <strong>{formatMoney(d.solde, d.currency)}</strong> / {formatMoney(Number(d.amount), d.currency)}
                    </span>
                    {!d.settled && (
                      <button className={styles.boutonSecondaire} onClick={() => payerDette(d.id, d.solde)}>
                        Enregistrer un règlement
                      </button>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ActiviteDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <ComptableShell>
      <ActiviteContenu activityId={params.id} />
    </ComptableShell>
  );
}
