"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface Plan {
  id: string;
  category: "MARKETPLACE" | "GESTION";
  name: string;
  openingFee: string;
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

/**
 * Fonctionnalités ELEGANZ Gestion lues par ShopMembershipGuard
 * (@RequiresGestionFeature), ShopsService.inviteStaff, CatalogController
 * (variantesProduits) et ReportsController/ProductImportController
 * (exportExcelPdf) — 14 oct. 2026, plan commercial. Jamais une liste
 * décorative : cocher/décocher ici change réellement ce qu'une boutique de
 * ce bouquet peut faire, sans redéploiement.
 */
const FONCTIONNALITES_GESTION: { cle: string; label: string }[] = [
  { cle: "financeAvancee", label: "Finance avancée (journal, grand livre, balance, états financiers, simulation fiscale, analytique)" },
  { cle: "immobilisations", label: "Immobilisations et amortissements" },
  { cle: "cloture", label: "Clôture comptable mensuelle" },
  { cle: "tresorerie", label: "Relevé de trésorerie" },
  { cle: "comptableExterne", label: "Invitation d'un comptable externe" },
  { cle: "variantesProduits", label: "Création de variantes en lot (plusieurs tailles/couleurs à la fois)" },
  { cle: "exportExcelPdf", label: "Export Excel / PDF (catalogue et relevés d'activité)" },
];

function LignePlan({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const estGestion = plan.category === "GESTION";
  const [ouvertureFee, setOuvertureFee] = useState(plan.openingFee);
  const [prix, setPrix] = useState(plan.monthlyPrice);
  const [maxProduits, setMaxProduits] = useState(plan.maxActiveProducts?.toString() ?? "");
  const [features, setFeatures] = useState(featuresToTexte(plan.featuresJson));
  const [coches, setCoches] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FONCTIONNALITES_GESTION.map(({ cle }) => [cle, plan.featuresJson[cle] === true])),
  );
  const maxEquipeInitial = plan.featuresJson.maxEquipe;
  const [maxEquipe, setMaxEquipe] = useState(
    typeof maxEquipeInitial === "number" ? String(maxEquipeInitial) : "",
  );
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      const featuresAEnvoyer = estGestion
        ? {
            ...Object.fromEntries(FONCTIONNALITES_GESTION.map(({ cle }) => [cle, coches[cle] === true])),
            maxEquipe: maxEquipe ? Number(maxEquipe) : null,
          }
        : texteToFeatures(features);
      await api.patch(`/admin/billing/plans/${plan.id}`, {
        openingFee: Number(ouvertureFee || 0),
        monthlyPrice: Number(prix),
        maxActiveProducts: maxProduits ? Number(maxProduits) : null,
        features: featuresAEnvoyer,
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
          <span>Frais d&apos;ouverture (USD, une fois à la souscription)</span>
          <input value={ouvertureFee} onChange={(e) => setOuvertureFee(e.target.value)} />
        </label>
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
        {estGestion && (
          <label className={styles.champ}>
            <span>Taille d&apos;équipe max. (hors propriétaire)</span>
            <input placeholder="Illimité" value={maxEquipe} onChange={(e) => setMaxEquipe(e.target.value)} />
          </label>
        )}
        {!estGestion && (
          <label className={styles.champLarge}>
            <span>Fonctionnalités incluses (ex. &quot;livraison, analytics: avancé&quot;)</span>
            <input value={features} onChange={(e) => setFeatures(e.target.value)} />
          </label>
        )}
      </div>
      {estGestion && (
        <div className={styles.planChamps} style={{ flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Fonctionnalités incluses dans ce bouquet</span>
          {FONCTIONNALITES_GESTION.map(({ cle, label }) => (
            <label key={cle} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={coches[cle] === true}
                onChange={(e) => setCoches((c) => ({ ...c, [cle]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      )}
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
  const [ouvertureFee, setOuvertureFee] = useState("");
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
        openingFee: ouvertureFee ? Number(ouvertureFee) : undefined,
        monthlyPrice: Number(prix),
        maxActiveProducts: maxProduits ? Number(maxProduits) : undefined,
      });
      setName("");
      setOuvertureFee("");
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
        placeholder="Frais d'ouverture (USD, vide = 0)"
        value={ouvertureFee}
        onChange={(e) => setOuvertureFee(e.target.value)}
      />
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
      <p style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)", flexBasis: "100%" }}>
        Les fonctionnalités détaillées (Finance avancée, immobilisations, taille d&apos;équipe…) se
        règlent juste après la création, sur la fiche du bouquet ci-dessus.
      </p>
    </form>
  );
}

interface PlatformSettings {
  driverOpeningFee: string;
  driverMonthlyFee: string;
  driverFreeMonths: number;
  comptableMonthlyFee: string;
  comptableYearlyFee: string;
  comptableFreeMonths: number;
}

/**
 * Tarification de l'espace livreur (prompt du 13 oct. 2026, point 1) —
 * 100 % paramétrable ici, sans redéploiement : frais d'ouverture à la
 * souscription, abonnement mensuel, et nombre de mois de gratuité décompté
 * à partir de la validation (vérification) du dossier par l'admin. Les
 * boutons de déclenchement manuel du cycle de facturation vivent ici aussi,
 * tant qu'aucun planificateur n'est en place (voir DriverBillingService).
 */
function TarifsLivreursSection() {
  const [ouvertureFee, setOuvertureFee] = useState("");
  const [mensuelFee, setMensuelFee] = useState("");
  const [moisGratuits, setMoisGratuits] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function recharger() {
    api
      .get<PlatformSettings>("/admin/platform-settings")
      .then((s) => {
        setOuvertureFee(s.driverOpeningFee);
        setMensuelFee(s.driverMonthlyFee);
        setMoisGratuits(String(s.driverFreeMonths));
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.patch("/admin/platform-settings", {
        driverOpeningFee: Number(ouvertureFee),
        driverMonthlyFee: Number(mensuelFee),
        driverFreeMonths: Number(moisGratuits),
      });
      setMessage("Tarifs livreurs enregistrés.");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function declencher(action: string, chemin: string) {
    setActionEnCours(action);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${action} : ${resultat.length} livreur(s) concerné(s).`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des tarifs livreurs…</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>Tarification de l&apos;espace livreur</span>
      </div>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>Frais d&apos;ouverture (USD, à la souscription)</span>
          <input value={ouvertureFee} onChange={(e) => setOuvertureFee(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Abonnement mensuel (USD)</span>
          <input value={mensuelFee} onChange={(e) => setMensuelFee(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Mois de gratuité après validation du dossier</span>
          <input value={moisGratuits} onChange={(e) => setMoisGratuits(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          Enregistrer les tarifs
        </button>
      </div>
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Vérification des gratuités échues", "/admin/driver-billing/run-trial-check")}
        >
          Vérifier les gratuités échues
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Facturation mensuelle", "/admin/driver-billing/run-monthly-billing")}
        >
          Lancer la facturation mensuelle
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Suspension des impayés", "/admin/driver-billing/run-suspension-check")}
        >
          Suspendre les livreurs en impayé
        </button>
      </div>
    </div>
  );
}

/**
 * Tarification d'ELEGANZ Mon Comptable (prompt du 13 oct. 2026, §14) —
 * même découpage que TarifsLivreursSection : 6 mois gratuits dès la
 * première activation, puis une formule mensuelle ou annuelle, 100 %
 * paramétrables ici.
 */
function TarifsComptableSection() {
  const [mensuel, setMensuel] = useState("");
  const [annuel, setAnnuel] = useState("");
  const [moisGratuits, setMoisGratuits] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function recharger() {
    api
      .get<PlatformSettings>("/admin/platform-settings")
      .then((s) => {
        setMensuel(s.comptableMonthlyFee);
        setAnnuel(s.comptableYearlyFee);
        setMoisGratuits(String(s.comptableFreeMonths));
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.patch("/admin/platform-settings", {
        comptableMonthlyFee: Number(mensuel),
        comptableYearlyFee: Number(annuel),
        comptableFreeMonths: Number(moisGratuits),
      });
      setMessage("Tarifs Mon Comptable enregistrés.");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function declencher(action: string, chemin: string) {
    setActionEnCours(action);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${action} : ${resultat.length} compte(s) concerné(s).`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des tarifs Mon Comptable…</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>Tarification d&apos;ELEGANZ Mon Comptable</span>
      </div>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>Abonnement mensuel (USD)</span>
          <input value={mensuel} onChange={(e) => setMensuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Abonnement annuel (USD)</span>
          <input value={annuel} onChange={(e) => setAnnuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Mois de gratuité dès la première activation</span>
          <input value={moisGratuits} onChange={(e) => setMoisGratuits(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          Enregistrer les tarifs
        </button>
      </div>
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Vérification des gratuités échues", "/admin/comptable/run-trial-check")}
        >
          Vérifier les gratuités échues
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Facturation de renouvellement", "/admin/comptable/run-renewal-billing")}
        >
          Lancer la facturation de renouvellement
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Suspension des impayés", "/admin/comptable/run-suspension-check")}
        >
          Suspendre les comptes en impayé
        </button>
      </div>
    </div>
  );
}

/**
 * Cycle de facturation des boutiques ELEGANZ Gestion (14 oct. 2026, plan
 * commercial) — jusqu'ici seul le frais d'ouverture (une fois) était
 * facturé ; ceci ajoute la facture mensuelle récurrente au tarif du bouquet
 * Gestion de chaque boutique active. Même déclenchement manuel que
 * livreurs/Mon Comptable, tant qu'aucun planificateur n'est en place.
 */
function TarifsBoutiquesSection() {
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function declencher(action: string, chemin: string) {
    setActionEnCours(action);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${action} : ${resultat.length} boutique(s) concernée(s).`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>Facturation des boutiques (bouquets Gestion)</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Frais d&apos;ouverture à la fin de la période gratuite (selon le bouquet de chaque boutique),
        puis abonnement mensuel récurrent une fois la boutique active.
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Vérification des gratuités échues", "/admin/billing/run-trial-check")}
        >
          Vérifier les gratuités échues
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Facturation mensuelle", "/admin/billing/run-monthly-billing")}
        >
          Lancer la facturation mensuelle
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Suspension des impayés", "/admin/billing/run-suspension-check")}
        >
          Suspendre les boutiques en impayé
        </button>
      </div>
    </div>
  );
}

interface TauxChangeHistorique {
  id: string;
  cdfPerUsd: string;
  setAt: string;
}

/**
 * Taux de change système CDF/USD (prompt du 13 oct. 2026, point 5) — un
 * seul taux pour toute la plateforme, modifiable uniquement ici. Un aperçu
 * du calcul ("1 USD = X CDF", "1000 CDF ≈ Y USD") s'affiche en direct
 * pendant la saisie, avant d'enregistrer, pour repérer une faute de frappe
 * qui fausserait l'affichage sur toute la plateforme (ex. 2.9 au lieu de
 * 2900). Phase 1 seulement : affichage courant, rien n'est figé sur les
 * ventes/opérations déjà enregistrées (voir docs/PROJECT_STATUS.md).
 */
function TauxChangeSection() {
  const [tauxActuel, setTauxActuel] = useState<string | null>(null);
  const [misAJourLe, setMisAJourLe] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  const [historique, setHistorique] = useState<TauxChangeHistorique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function recharger() {
    Promise.all([
      api.get<{ cdfPerUsd: string | null; exchangeRateUpdatedAt: string | null }>("/admin/platform-settings"),
      api.get<TauxChangeHistorique[]>("/admin/platform-settings/exchange-rate-history"),
    ])
      .then(([s, h]) => {
        setTauxActuel(s.cdfPerUsd);
        setMisAJourLe(s.exchangeRateUpdatedAt);
        setSaisie(s.cdfPerUsd ?? "");
        setHistorique(h);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  const valeur = Number(saisie.replace(",", "."));
  const apercuValide = saisie.trim() !== "" && Number.isFinite(valeur) && valeur > 0;

  async function enregistrer() {
    if (!apercuValide) return;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.patch("/admin/platform-settings/exchange-rate", { cdfPerUsd: valeur });
      setMessage("Taux de change enregistré.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>Chargement du taux de change…</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>Taux de change système (CDF / USD)</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Un seul taux pour toute la plateforme — utilisé pour afficher un équivalent de devise partout
        où c&apos;est utile (Marketplace, Caisse, Mon Comptable). Les boutiques peuvent vous demander une
        mise à jour en cas d&apos;oubli ou de retard, mais ne le modifient pas elles-mêmes.
      </p>
      {tauxActuel ? (
        <p style={{ padding: "0 16px", fontSize: "0.875rem" }}>
          Taux actuel : <strong>1 USD = {tauxActuel} CDF</strong>
          {misAJourLe && ` — mis à jour le ${new Date(misAJourLe).toLocaleString("fr-FR")}`}
        </p>
      ) : (
        <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-flamme)" }}>
          Aucun taux configuré pour l&apos;instant — aucun équivalent de devise ne s&apos;affiche nulle part
          tant que ce n&apos;est pas fait.
        </p>
      )}
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>Combien de CDF pour 1 USD ?</span>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="ex. 2900" />
        </label>
      </div>
      {apercuValide && (
        <p style={{ padding: "0 16px", fontSize: "0.875rem", fontFamily: "var(--font-mono), monospace" }}>
          Aperçu avant d&apos;enregistrer : 1 USD = {valeur.toLocaleString("fr-FR")} CDF — 1 000 CDF ≈{" "}
          {(1000 / valeur).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} USD
        </p>
      )}
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours || !apercuValide} onClick={enregistrer}>
          Enregistrer le taux
        </button>
      </div>
      {historique.length > 0 && (
        <details style={{ padding: "0 16px 16px" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.875rem" }}>Historique des changements</summary>
          <ul style={{ fontSize: "0.8125rem", marginTop: 8 }}>
            {historique.map((h) => (
              <li key={h.id}>
                1 USD = {h.cdfPerUsd} CDF — {new Date(h.setAt).toLocaleString("fr-FR")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
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

      <h2 className={styles.sectionTitre}>Facturation des boutiques</h2>
      <TarifsBoutiquesSection />

      <h2 className={styles.sectionTitre}>Tarifs livreurs</h2>
      <TarifsLivreursSection />

      <h2 className={styles.sectionTitre}>Tarifs Mon Comptable</h2>
      <TarifsComptableSection />

      <h2 className={styles.sectionTitre}>Taux de change</h2>
      <TauxChangeSection />
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
