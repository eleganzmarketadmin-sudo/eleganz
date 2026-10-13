"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ComptableShell } from "../../ComptableShell";
import { api, ApiError } from "../../../lib/api";
import { formatMoney, formatDate } from "../../../lib/money";
import { ajouterOperation } from "../../../lib/offline-queue";
import { useOfflineSync } from "../../../lib/offline-sync";
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

interface PaiementLoyer {
  id: string;
  periodLabel: string;
  expectedAmount: string;
  receivedAmount: string;
  dueDate: string;
  paidAt: string | null;
}

interface DepenseLocative {
  id: string;
  category: string;
  amount: string;
  currency: "CDF" | "USD";
  date: string;
}

interface BienLocatif {
  id: string;
  label: string;
  location: string | null;
  tenantName: string | null;
  rentAmount: string;
  currency: "CDF" | "USD";
  frequency: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL" | "PERSONNALISE";
  leaseStart: string | null;
  leaseEnd: string | null;
  depositAmount: string | null;
  payments: PaiementLoyer[];
  expenses: DepenseLocative[];
}

interface VersementTravailleur {
  id: string;
  workerName: string;
  periodLabel: string;
  expectedAmount: string | null;
  declaredRevenue: string | null;
  declaredExpenses: string | null;
  paidAmount: string;
  currency: "CDF" | "USD";
  dueDate: string | null;
  settledAt: string | null;
  note: string | null;
}

const LABELS_TYPE_DETTE: Record<string, string> = {
  DETTE: "Dette (je dois payer)",
  CREANCE: "Créance (on me doit)",
  EMPRUNT: "Emprunt",
};

const LABELS_FREQUENCE: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel",
  PERSONNALISE: "Personnalisé",
};

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

function ActiviteContenu({ activityId }: { activityId: string }) {
  const { rafraichirCompteur, synchroniser } = useOfflineSync();
  const [activite, setActivite] = useState<Activite | null>(null);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [dettes, setDettes] = useState<Dette[]>([]);
  const [biens, setBiens] = useState<BienLocatif[]>([]);
  const [versements, setVersements] = useState<VersementTravailleur[]>([]);
  const [onglet, setOnglet] = useState<"carnet" | "dettes" | "locatif" | "travailleurs">("carnet");
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

  // Formulaire bien locatif
  const [formulaireBienOuvert, setFormulaireBienOuvert] = useState(false);
  const [labelBien, setLabelBien] = useState("");
  const [lieuBien, setLieuBien] = useState("");
  const [locataireBien, setLocataireBien] = useState("");
  const [loyerBien, setLoyerBien] = useState("");
  const [deviseBien, setDeviseBien] = useState<"CDF" | "USD">("USD");
  const [frequenceBien, setFrequenceBien] = useState<BienLocatif["frequency"]>("MENSUEL");
  const [depotBien, setDepotBien] = useState("");

  // Formulaire versement travailleur
  const [formulaireVersementOuvert, setFormulaireVersementOuvert] = useState(false);
  const [nomTravailleur, setNomTravailleur] = useState("");
  const [periodeVersement, setPeriodeVersement] = useState("");
  const [montantVerse, setMontantVerse] = useState("");
  const [deviseVersement, setDeviseVersement] = useState<"CDF" | "USD">("USD");

  function recharger() {
    Promise.all([
      api.get<Activite[]>("/comptable/activities"),
      api.get<Entree[]>(`/comptable/entries?activityId=${activityId}`),
      api.get<Dette[]>(`/comptable/debts?activityId=${activityId}`),
      api.get<BienLocatif[]>(`/comptable/rental-units?activityId=${activityId}`),
      api.get<VersementTravailleur[]>(`/comptable/worker-remittances?activityId=${activityId}`),
    ])
      .then(([activites, listeEntrees, listeDettes, listeBiens, listeVersements]) => {
        setActivite(activites.find((a) => a.id === activityId) ?? null);
        setEntrees(listeEntrees);
        setDettes(listeDettes);
        setBiens(listeBiens);
        setVersements(listeVersements);
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
    const payload = {
      activityId,
      date,
      salesCdf: ventesCdf ? Number(ventesCdf) : undefined,
      salesUsd: ventesUsd ? Number(ventesUsd) : undefined,
      expensesCdf: depensesCdf ? Number(depensesCdf) : undefined,
      expensesUsd: depensesUsd ? Number(depensesUsd) : undefined,
      note: observation.trim() || undefined,
    };
    try {
      await api.post("/comptable/entries/quick", payload);
      setVentesCdf("");
      setVentesUsd("");
      setDepensesCdf("");
      setDepensesUsd("");
      setObservation("");
      setMessage("Saisie enregistrée.");
      recharger();
      return;
    } catch (err) {
      // statusCode === 0 : serveur inatteignable (coupure réseau), pas un
      // refus — on met la saisie en file d'attente plutôt que de la perdre
      // (réponse du 13 oct. 2026, point 2 : "saisie différée synchronisée au
      // retour du réseau"), même principe que la Caisse hors-ligne
      // (docs/ARCHITECTURE_HORS_LIGNE.md).
      if (err instanceof ApiError && err.statusCode === 0) {
        try {
          const clientOperationId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await ajouterOperation({
            clientOperationId,
            type: "COMPTABLE_QUICK_ENTRY",
            payload,
            createdAtClient: new Date().toISOString(),
            tentatives: 0,
          });
          await rafraichirCompteur();
          setVentesCdf("");
          setVentesUsd("");
          setDepensesCdf("");
          setDepensesUsd("");
          setObservation("");
          setMessage("Saisie enregistrée hors-ligne — elle se synchronisera automatiquement dès le retour du réseau.");
          synchroniser();
        } catch {
          setErreur(
            "Pas de réseau et la saisie n'a pas pu être mise en attente localement — notez-la manuellement.",
          );
        }
      } else {
        setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
      }
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

  async function creerBien(e: React.FormEvent) {
    e.preventDefault();
    if (!labelBien.trim() || !loyerBien) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/rental-units", {
        activityId,
        label: labelBien.trim(),
        location: lieuBien.trim() || undefined,
        tenantName: locataireBien.trim() || undefined,
        rentAmount: Number(loyerBien),
        currency: deviseBien,
        frequency: frequenceBien,
        depositAmount: depotBien ? Number(depotBien) : undefined,
      });
      setLabelBien("");
      setLieuBien("");
      setLocataireBien("");
      setLoyerBien("");
      setDepotBien("");
      setFormulaireBienOuvert(false);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrerLoyer(unit: BienLocatif) {
    const periode = window.prompt("Période concernée (ex. Octobre 2026)", "");
    if (!periode) return;
    const recuTexte = window.prompt(`Montant reçu pour ce loyer (attendu : ${unit.rentAmount} ${unit.currency})`, unit.rentAmount);
    if (recuTexte === null) return;
    const recu = Number(recuTexte);
    if (Number.isNaN(recu) || recu < 0) return;
    const echeance = window.prompt("Date d'échéance (AAAA-MM-JJ)", aujourdHui());
    if (!echeance) return;
    setErreur(null);
    try {
      await api.post(`/comptable/rental-units/${unit.id}/payments`, {
        periodLabel: periode,
        expectedAmount: Number(unit.rentAmount),
        receivedAmount: recu,
        dueDate: echeance,
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  }

  async function ajouterDepenseLocative(unit: BienLocatif) {
    const categorie = window.prompt("Catégorie de dépense (entretien, réparation, eau, électricité…)", "");
    if (!categorie) return;
    const montantTexte = window.prompt("Montant", "");
    if (!montantTexte) return;
    const montant = Number(montantTexte);
    if (!montant || montant <= 0) return;
    setErreur(null);
    try {
      await api.post(`/comptable/rental-units/${unit.id}/expenses`, {
        category: categorie,
        amount: montant,
        currency: unit.currency,
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  }

  async function creerVersement(e: React.FormEvent) {
    e.preventDefault();
    if (!nomTravailleur.trim() || !periodeVersement.trim() || !montantVerse) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/worker-remittances", {
        activityId,
        workerName: nomTravailleur.trim(),
        periodLabel: periodeVersement.trim(),
        paidAmount: Number(montantVerse),
        currency: deviseVersement,
      });
      setNomTravailleur("");
      setPeriodeVersement("");
      setMontantVerse("");
      setFormulaireVersementOuvert(false);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function soldeVersement(id: string) {
    setErreur(null);
    try {
      await api.post(`/comptable/worker-remittances/${id}/settled`, {});
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Opération impossible.");
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
        <button
          className={`${styles.onglet} ${onglet === "locatif" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("locatif")}
        >
          Locatif
        </button>
        <button
          className={`${styles.onglet} ${onglet === "travailleurs" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("travailleurs")}
        >
          Travailleurs
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

      {onglet === "locatif" && (
        <>
          <h2 className={styles.sectionTitre}>Biens locatifs</h2>
          {!formulaireBienOuvert ? (
            <button className={styles.bouton} onClick={() => setFormulaireBienOuvert(true)}>
              + Nouveau bien
            </button>
          ) : (
            <form className={styles.formulaireDette} onSubmit={creerBien} style={{ marginTop: "16px" }}>
              <label className={styles.champLarge}>
                <span>Désignation</span>
                <input
                  placeholder="Ex. Appartement 2, Lemba"
                  value={labelBien}
                  onChange={(e) => setLabelBien(e.target.value)}
                  required
                />
              </label>
              <label className={styles.champLarge}>
                <span>Lieu (facultatif)</span>
                <input value={lieuBien} onChange={(e) => setLieuBien(e.target.value)} />
              </label>
              <label className={styles.champLarge}>
                <span>Locataire (facultatif)</span>
                <input value={locataireBien} onChange={(e) => setLocataireBien(e.target.value)} />
              </label>
              <label className={styles.champ}>
                <span>Loyer</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={loyerBien}
                  onChange={(e) => setLoyerBien(e.target.value)}
                  required
                />
              </label>
              <label className={styles.champ}>
                <span>Devise</span>
                <select value={deviseBien} onChange={(e) => setDeviseBien(e.target.value as "CDF" | "USD")}>
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </label>
              <label className={styles.champ}>
                <span>Fréquence</span>
                <select
                  value={frequenceBien}
                  onChange={(e) => setFrequenceBien(e.target.value as BienLocatif["frequency"])}
                >
                  {Object.entries(LABELS_FREQUENCE).map(([valeur, label]) => (
                    <option key={valeur} value={valeur}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.champ}>
                <span>Garantie (facultative)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depotBien}
                  onChange={(e) => setDepotBien(e.target.value)}
                />
              </label>
              <button className={styles.bouton} type="submit" disabled={enCours}>
                Enregistrer
              </button>
              <button
                type="button"
                className={styles.boutonSecondaire}
                onClick={() => setFormulaireBienOuvert(false)}
              >
                Annuler
              </button>
            </form>
          )}

          <div style={{ marginTop: "16px" }}>
            {biens.length === 0 ? (
              <p className={styles.messageVide}>Aucun bien locatif enregistré pour l&apos;instant.</p>
            ) : (
              biens.map((b) => {
                const totalRecu = b.payments.reduce((s, p) => s + Number(p.receivedAmount), 0);
                const totalDepenses = b.expenses.reduce((s, dep) => s + Number(dep.amount), 0);
                return (
                  <div className={styles.carteBien} key={b.id}>
                    <div className={styles.carteBienEntete}>
                      <strong>{b.label}</strong>
                      <span>
                        {formatMoney(Number(b.rentAmount), b.currency)} / {LABELS_FREQUENCE[b.frequency].toLowerCase()}
                      </span>
                    </div>
                    <p className={styles.carteBienDetail}>
                      {b.tenantName ? `Locataire : ${b.tenantName}` : "Pas de locataire renseigné"}
                      {b.location ? ` · ${b.location}` : ""}
                      {b.depositAmount ? ` · Garantie : ${formatMoney(Number(b.depositAmount), b.currency)}` : ""}
                    </p>
                    <p className={styles.carteBienDetail}>
                      Reçu sur les 12 dernières périodes : <strong>{formatMoney(totalRecu, b.currency)}</strong> ·
                      Dépenses récentes : <strong>{formatMoney(totalDepenses, b.currency)}</strong>
                    </p>
                    <div className={styles.carteBienActions}>
                      <button className={styles.boutonSecondaire} onClick={() => enregistrerLoyer(b)}>
                        Enregistrer un loyer
                      </button>
                      <button className={styles.boutonSecondaire} onClick={() => ajouterDepenseLocative(b)}>
                        Ajouter une dépense
                      </button>
                    </div>
                    {b.payments.length > 0 && (
                      <div className={styles.sousListe}>
                        {b.payments.slice(0, 5).map((p) => (
                          <div className={styles.ligne} key={p.id}>
                            <span>
                              {p.periodLabel} — échéance {formatDate(p.dueDate)}
                              {p.paidAt ? " · réglé" : " · en attente"}
                            </span>
                            <strong>
                              {formatMoney(Number(p.receivedAmount), b.currency)} / {formatMoney(Number(p.expectedAmount), b.currency)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {onglet === "travailleurs" && (
        <>
          <h2 className={styles.sectionTitre}>Versements des travailleurs</h2>
          <p className={styles.sousTitre}>
            Pour une activité confiée à quelqu&apos;un (chauffeur, gérant…) — ce que le travailleur vous remet, pas un
            revenu de la caisse.
          </p>
          {!formulaireVersementOuvert ? (
            <button className={styles.bouton} onClick={() => setFormulaireVersementOuvert(true)}>
              + Nouveau versement
            </button>
          ) : (
            <form className={styles.formulaireDette} onSubmit={creerVersement} style={{ marginTop: "16px" }}>
              <label className={styles.champLarge}>
                <span>Nom du travailleur</span>
                <input value={nomTravailleur} onChange={(e) => setNomTravailleur(e.target.value)} required />
              </label>
              <label className={styles.champ}>
                <span>Période</span>
                <input
                  placeholder="Ex. Semaine du 6 au 12 oct."
                  value={periodeVersement}
                  onChange={(e) => setPeriodeVersement(e.target.value)}
                  required
                />
              </label>
              <label className={styles.champ}>
                <span>Montant remis</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={montantVerse}
                  onChange={(e) => setMontantVerse(e.target.value)}
                  required
                />
              </label>
              <label className={styles.champ}>
                <span>Devise</span>
                <select value={deviseVersement} onChange={(e) => setDeviseVersement(e.target.value as "CDF" | "USD")}>
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </label>
              <button className={styles.bouton} type="submit" disabled={enCours}>
                Enregistrer
              </button>
              <button
                type="button"
                className={styles.boutonSecondaire}
                onClick={() => setFormulaireVersementOuvert(false)}
              >
                Annuler
              </button>
            </form>
          )}

          <div style={{ marginTop: "16px" }}>
            {versements.length === 0 ? (
              <p className={styles.messageVide}>Aucun versement enregistré pour l&apos;instant.</p>
            ) : (
              versements.map((v) => (
                <div className={`${styles.ligne} ${v.settledAt ? styles.ligneSoldee : ""}`} key={v.id}>
                  <span>
                    <strong>{v.workerName}</strong> — {v.periodLabel}
                    {v.settledAt && " · soldé"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <strong>{formatMoney(Number(v.paidAmount), v.currency)}</strong>
                    {!v.settledAt && (
                      <button className={styles.boutonSecondaire} onClick={() => soldeVersement(v.id)}>
                        Marquer soldé
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
