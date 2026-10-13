"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "./page.module.css";

// Charges et dépenses (prompt du 13 oct. 2026, §8) — groupées en 6 familles,
// mais enregistrées avec une sous-catégorie précise (le serveur valide la
// liste complète, voir apps/api/src/operations/dto/expense.dto.ts).
const GROUPES: { groupe: string; categories: { valeur: string; label: string }[] }[] = [
  {
    groupe: "Fonctionnement",
    categories: [
      { valeur: "loyer", label: "Loyer" },
      { valeur: "eau", label: "Eau" },
      { valeur: "electricite", label: "Électricité" },
      { valeur: "internet", label: "Internet" },
      { valeur: "telecommunications", label: "Téléphone" },
      { valeur: "transport", label: "Transport" },
      { valeur: "carburant", label: "Carburant" },
      { valeur: "entretien", label: "Entretien" },
      { valeur: "reparations", label: "Réparations" },
      { valeur: "fournitures", label: "Fournitures" },
    ],
  },
  {
    groupe: "Personnel",
    categories: [
      { valeur: "salaires", label: "Salaires" },
      { valeur: "primes", label: "Primes" },
      { valeur: "charges_sociales", label: "Charges sociales" },
    ],
  },
  {
    groupe: "Charges administratives",
    categories: [
      { valeur: "frais_bancaires", label: "Frais bancaires" },
      { valeur: "honoraires", label: "Honoraires" },
      { valeur: "assurances", label: "Assurances" },
      { valeur: "abonnements_logiciels", label: "Abonnements / logiciels" },
    ],
  },
  {
    groupe: "Charges commerciales",
    categories: [
      { valeur: "publicite", label: "Publicité" },
      { valeur: "promotions", label: "Promotions" },
      { valeur: "livraison", label: "Livraison" },
      { valeur: "emballages", label: "Emballages" },
      { valeur: "commissions", label: "Commissions" },
    ],
  },
  { groupe: "Fiscalité", categories: [{ valeur: "impots_taxes", label: "Impôts et taxes" }] },
  {
    groupe: "Financement",
    categories: [
      { valeur: "interets_frais_financiers", label: "Intérêts / frais financiers" },
      { valeur: "remboursement_capital", label: "Remboursement de capital" },
    ],
  },
  { groupe: "Autre", categories: [{ valeur: "autre", label: "Autre" }] },
];

const LABELS_CATEGORIE: Record<string, string> = Object.fromEntries(
  GROUPES.flatMap((g) => g.categories.map((c) => [c.valeur, c.label])),
);

interface Depense {
  id: string;
  category: string;
  amount: string | number;
  currency: string;
  note: string | null;
  createdAt: string;
}

function ChargesContent() {
  const { currentShop } = useShop();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [categorie, setCategorie] = useState(GROUPES[0].categories[0].valeur);
  const [montant, setMontant] = useState("");
  const [devise, setDevise] = useState<"USD" | "CDF">("USD");
  const [note, setNote] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Depense[]>(`/shops/${currentShop.id}/expenses`)
      .then(setDepenses)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop || !montant) return;
    setEnregistrementEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/expenses`, {
        category: categorie,
        amount: Number(montant),
        currency: devise,
        note: note || undefined,
      });
      setMontant("");
      setNote("");
      setConfirmation("Charge enregistrée.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />
      <h2 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Charges et dépenses</h2>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.formulaire} onSubmit={enregistrer}>
        <div className={styles.champ}>
          <label htmlFor="categorie">Catégorie</label>
          <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {GROUPES.map((g) => (
              <optgroup key={g.groupe} label={g.groupe}>
                {g.categories.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="montant">Montant</label>
          <input id="montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="devise">Devise</label>
          <select id="devise" value={devise} onChange={(e) => setDevise(e.target.value as "USD" | "CDF")}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="note">Note (facultatif)</label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. loyer d'octobre" />
        </div>
        <button className={styles.bouton} type="submit" disabled={enregistrementEnCours || !montant}>
          {enregistrementEnCours ? "Enregistrement…" : "Enregistrer la charge"}
        </button>
      </form>

      {chargement ? (
        <p>Chargement…</p>
      ) : depenses.length === 0 ? (
        <p>Aucune charge enregistrée pour l&apos;instant.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {depenses.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>{LABELS_CATEGORIE[d.category] ?? d.category}</td>
                <td>
                  {Number(d.amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {d.currency}
                </td>
                <td>{d.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ChargesPage() {
  return (
    <ProtectedGestionPage>
      <ChargesContent />
    </ProtectedGestionPage>
  );
}
