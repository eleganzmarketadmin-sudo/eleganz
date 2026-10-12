"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface Plan {
  id: string;
  category: "MARKETPLACE" | "GESTION";
  name: string;
  monthlyPrice: string;
  maxActiveProducts: number | null;
  active: boolean;
  featuresJson: Record<string, unknown>;
}

function featuresToTexte(features: Record<string, unknown>): string {
  return Object.entries(features)
    .map(([cle, valeur]) => (valeur === true ? cle : `${cle}: ${valeur}`))
    .join(", ");
}

function texteToFeatures(texte: string): Record<string, unknown> {
  const features: Record<string, unknown> = {};
  texte
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entree) => {
      const [cle, valeur] = entree.split(":").map((s) => s.trim());
      features[cle] = valeur === undefined ? true : valeur;
    });
  return features;
}

function LignePlan({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const [prix, setPrix] = useState(plan.monthlyPrice);
  const [maxProduits, setMaxProduits] = useState(plan.maxActiveProducts?.toString() ?? "");
  const [features, setFeatures] = useState(featuresToTexte(plan.featuresJson));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/billing/plans/${plan.id}`, {
        monthlyPrice: Number(prix),
        maxActiveProducts: maxProduits ? Number(maxProduits) : null,
        features: texteToFeatures(features),
      });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function basculerActif() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/billing/plans/${plan.id}`, { active: !plan.active });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`${styles.plan} ${!plan.active ? styles.planInactif : ""}`}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{plan.name}</span>
        <span className={styles.planStatut}>{plan.active ? "Actif" : "Désactivé"}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>Prix mensuel (USD)</span>
          <input value={prix} onChange={(e) => setPrix(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Articles actifs max.</span>
          <input
            placeholder="Illimité"
            value={maxProduits}
            onChange={(e) => setMaxProduits(e.target.value)}
          />
        </label>
        <label className={styles.champLarge}>
          <span>Fonctionnalités incluses (ex. "livraison, analytics: avancé")</span>
          <input value={features} onChange={(e) => setFeatures(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          Enregistrer
        </button>
        <button className={styles.boutonBasculer} disabled={enCours} onClick={basculerActif}>
          {plan.active ? "Désactiver" : "Réactiver"}
        </button>
      </div>
    </div>
  );
}

function FormulaireNouveauPlan({ onCree }: { onCree: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [category, setCategory] = useState<"GESTION" | "MARKETPLACE">("GESTION");
  const [name, setName] = useState("");
  const [prix, setPrix] = useState("");
  const [maxProduits, setMaxProduits] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/admin/billing/plans", {
        category,
        name,
        monthlyPrice: Number(prix),
        maxActiveProducts: maxProduits ? Number(maxProduits) : undefined,
      });
      setName("");
      setPrix("");
      setMaxProduits("");
      setOuvert(false);
      onCree();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button className={styles.boutonNouveau} onClick={() => setOuvert(true)}>
        + Nouveau bouquet
      </button>
    );
  }

  return (
    <form className={styles.nouveauPlan} onSubmit={creer}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <select value={category} onChange={(e) => setCategory(e.target.value as "GESTION" | "MARKETPLACE")}>
        <option value="GESTION">Gestion</option>
        <option value="MARKETPLACE">Marketplace</option>
      </select>
      <input placeholder="Nom du bouquet" value={name} onChange={(e) => setName(e.target.value)} required />
      <input
        placeholder="Prix mensuel (USD)"
        value={prix}
        onChange={(e) => setPrix(e.target.value)}
        required
      />
      <input
        placeholder="Articles actifs max. (vide = illimité)"
        value={maxProduits}
        onChange={(e) => setMaxProduits(e.target.value)}
      />
      <button className={styles.boutonEnregistrer} type="submit" disabled={enCours}>
        Créer
      </button>
      <button type="button" className={styles.boutonBasculer} onClick={() => setOuvert(false)}>
        Annuler
      </button>
    </form>
  );
}

function TarifsContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<Plan[]>("/admin/billing/plans")
      .then(setPlans)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>Chargement des tarifs…</p>;

  const gestion = plans.filter((p) => p.category === "GESTION");
  const marketplace = plans.filter((p) => p.category === "MARKETPLACE");

  return (
    <div>
      <h1 className={styles.titre}>Tarifs et conditions</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <h2 className={styles.sectionTitre}>Bouquets ELEGANZ Gestion</h2>
      {gestion.length === 0 && <p className={styles.messageVide}>Aucun bouquet Gestion.</p>}
      {gestion.map((plan) => (
        <LignePlan key={plan.id} plan={plan} onChange={recharger} />
      ))}

      <h2 className={styles.sectionTitre}>Bouquets Marketplace</h2>
      {marketplace.length === 0 && <p className={styles.messageVide}>Aucun bouquet Marketplace.</p>}
      {marketplace.map((plan) => (
        <LignePlan key={plan.id} plan={plan} onChange={recharger} />
      ))}

      <FormulaireNouveauPlan onCree={recharger} />
    </div>
  );
}

export default function AdminTarifsPage() {
  return (
    <AdminShell>
      <TarifsContent />
    </AdminShell>
  );
}
