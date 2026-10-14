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
  commissionRate: string | null;
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
  { cle: "comptabiliteSyscohada", label: "Comptabilité SYSCOHADA complète (plan comptable intégral, états financiers normalisés)" },
];

function LignePlan({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const estGestion = plan.category === "GESTION";
  const [ouvertureFee, setOuvertureFee] = useState(plan.openingFee);
  const [prix, setPrix] = useState(plan.monthlyPrice);
  const [maxProduits, setMaxProduits] = useState(plan.maxActiveProducts?.toString() ?? "");
  const [commission, setCommission] = useState(plan.commissionRate ?? "");
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
        commissionRate: estGestion ? undefined : commission ? Number(commission) : null,
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
          <label className={styles.champ}>
            <span>Commission sur les ventes (%, vide = taux par défaut de la plateforme)</span>
            <input
              placeholder="ex. 5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
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
  const [commission, setCommission] = useState("");
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
        commissionRate: category === "MARKETPLACE" && commission ? Number(commission) : undefined,
      });
      setName("");
      setOuvertureFee("");
      setPrix("");
      setMaxProduits("");
      setCommission("");
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
      {category === "MARKETPLACE" && (
        <input
          placeholder="Commission sur les ventes (%, vide = taux par défaut)"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />
      )}
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

interface ComptablePlan {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxActivities: number | null;
  active: boolean;
  featuresJson: Record<string, unknown>;
}

/**
 * Fonctionnalités des bouquets Mon Comptable (14 oct. 2026, proposition
 * validée par le propriétaire) — lues par ComptableService
 * (dashboardComparaison, dashboardHistorique, agenda) et ComptableController
 * (export/dossier-financement). Jamais une liste décorative, comme pour
 * FONCTIONNALITES_GESTION ci-dessus.
 */
const FONCTIONNALITES_COMPTABLE: { cle: string; label: string }[] = [
  { cle: "historiqueIllimite", label: "Historique du tableau de bord illimité (sinon plafonné à 60 jours)" },
  { cle: "comparaisonPeriodes", label: "Comparaison entre activités" },
  { cle: "rappelsAgenda", label: "Vue agenda complète (les rappels prioritaires restent toujours visibles)" },
  { cle: "exportDossierFinancement", label: "Export du dossier de financement bancaire" },
];

function LigneBouquetComptable({ bouquet, onChange }: { bouquet: ComptablePlan; onChange: () => void }) {
  const [mensuel, setMensuel] = useState(bouquet.monthlyPrice);
  const [annuel, setAnnuel] = useState(bouquet.yearlyPrice);
  const [maxActivites, setMaxActivites] = useState(bouquet.maxActivities?.toString() ?? "");
  const [coches, setCoches] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FONCTIONNALITES_COMPTABLE.map(({ cle }) => [cle, bouquet.featuresJson[cle] === true])),
  );
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/comptable/plans/${bouquet.id}`, {
        monthlyPrice: Number(mensuel),
        yearlyPrice: Number(annuel),
        maxActivities: maxActivites ? Number(maxActivites) : null,
        features: Object.fromEntries(FONCTIONNALITES_COMPTABLE.map(({ cle }) => [cle, coches[cle] === true])),
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
      await api.patch(`/admin/comptable/plans/${bouquet.id}`, { active: !bouquet.active });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`${styles.plan} ${!bouquet.active ? styles.planInactif : ""}`}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{bouquet.name}</span>
        <span className={styles.planStatut}>{bouquet.active ? "Actif" : "Désactivé"}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
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
          <span>Activités suivies simultanément max.</span>
          <input placeholder="Illimité" value={maxActivites} onChange={(e) => setMaxActivites(e.target.value)} />
        </label>
      </div>
      <div className={styles.planChamps} style={{ flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Fonctionnalités incluses dans ce bouquet</span>
        {FONCTIONNALITES_COMPTABLE.map(({ cle, label }) => (
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
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          Enregistrer
        </button>
        <button className={styles.boutonBasculer} disabled={enCours} onClick={basculerActif}>
          {bouquet.active ? "Désactiver" : "Réactiver"}
        </button>
      </div>
    </div>
  );
}

function FormulaireNouveauBouquetComptable({ onCree }: { onCree: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [mensuel, setMensuel] = useState("");
  const [annuel, setAnnuel] = useState("");
  const [maxActivites, setMaxActivites] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/admin/comptable/plans", {
        name: nom,
        monthlyPrice: Number(mensuel),
        yearlyPrice: Number(annuel),
        maxActivities: maxActivites ? Number(maxActivites) : undefined,
      });
      setNom("");
      setMensuel("");
      setAnnuel("");
      setMaxActivites("");
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
        + Nouveau bouquet Mon Comptable
      </button>
    );
  }

  return (
    <form className={styles.nouveauPlan} onSubmit={creer}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <input placeholder="Nom du bouquet" value={nom} onChange={(e) => setNom(e.target.value)} required />
      <input placeholder="Abonnement mensuel (USD)" value={mensuel} onChange={(e) => setMensuel(e.target.value)} required />
      <input placeholder="Abonnement annuel (USD)" value={annuel} onChange={(e) => setAnnuel(e.target.value)} required />
      <input
        placeholder="Activités max. (vide = illimité)"
        value={maxActivites}
        onChange={(e) => setMaxActivites(e.target.value)}
      />
      <button className={styles.boutonEnregistrer} type="submit" disabled={enCours}>
        Créer
      </button>
      <button type="button" className={styles.boutonBasculer} onClick={() => setOuvert(false)}>
        Annuler
      </button>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)", flexBasis: "100%" }}>
        Les fonctionnalités détaillées se règlent juste après la création, sur la fiche du bouquet
        ci-dessus.
      </p>
    </form>
  );
}

/**
 * Bouquets ELEGANZ Mon Comptable (14 oct. 2026, proposition validée par le
 * propriétaire — voir docs/PLAN_COMMERCIAL.md) : "Essentiel" reprend l'offre
 * actuelle à l'identique (jamais modifiée automatiquement), "Pro" et
 * "Premium" ajoutent de la valeur nouvelle. Entièrement gérable ici, sans
 * redéploiement — prix, limite d'activités, fonctionnalités.
 */
function BouquetsComptableSection() {
  const [bouquets, setBouquets] = useState<ComptablePlan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<ComptablePlan[]>("/admin/comptable/plans")
      .then(setBouquets)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>Chargement des bouquets Mon Comptable…</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {bouquets.length === 0 && <p className={styles.messageVide}>Aucun bouquet Mon Comptable.</p>}
      {bouquets.map((b) => (
        <LigneBouquetComptable key={b.id} bouquet={b} onChange={recharger} />
      ))}
      <FormulaireNouveauBouquetComptable onCree={recharger} />
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
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Depuis l&apos;introduction des bouquets ci-dessous, le prix facturé est celui du bouquet choisi
        par l&apos;abonné ; les tarifs ici ne servent plus que de filet de sécurité pour un abonnement
        qui se retrouverait sans bouquet rattaché. Le nombre de mois de gratuité reste global, pour
        tous les bouquets.
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>Abonnement mensuel de secours (USD)</span>
          <input value={mensuel} onChange={(e) => setMensuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>Abonnement annuel de secours (USD)</span>
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
  const [tauxDefaut, setTauxDefaut] = useState("");
  const [chargementTaux, setChargementTaux] = useState(true);
  const [enCoursTaux, setEnCoursTaux] = useState(false);

  useEffect(() => {
    api
      .get<{ marketplaceCommissionRateDefault: string | null }>("/admin/platform-settings")
      .then((s) => setTauxDefaut(s.marketplaceCommissionRateDefault ?? ""))
      .catch(() => {})
      .finally(() => setChargementTaux(false));
  }, []);

  async function enregistrerTauxDefaut() {
    setEnCoursTaux(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.patch("/admin/platform-settings", {
        marketplaceCommissionRateDefault: tauxDefaut ? Number(tauxDefaut) : null,
      });
      setMessage("Taux de commission par défaut enregistré.");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCoursTaux(false);
    }
  }

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

      <div className={styles.planEntete} style={{ borderTop: "1px solid var(--color-bordure)" }}>
        <span className={styles.planNom}>Commission ELEGANZ Market</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Taux global appliqué aux ventes des boutiques Marketplace dont le bouquet ne fixe pas son
        propre taux (modifiable par bouquet ci-dessus). Calculée à la création de chaque commande,
        facturée séparément sur les commandes terminées non encore facturées.
      </p>
      {!chargementTaux && (
        <div className={styles.planChamps}>
          <label className={styles.champ}>
            <span>Taux de commission par défaut (%, vide = aucune commission)</span>
            <input
              placeholder="ex. 5"
              value={tauxDefaut}
              onChange={(e) => setTauxDefaut(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button className={styles.boutonEnregistrer} disabled={enCoursTaux} onClick={enregistrerTauxDefaut}>
          Enregistrer le taux par défaut
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher("Facturation des commissions", "/admin/billing/run-commission-billing")}
        >
          Lancer la facturation des commissions
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

interface AiService {
  id: string;
  name: string;
  description: string | null;
  creditCost: number;
  active: boolean;
  provider: string | null;
}

interface AiCreditTopUpAdmin {
  id: string;
  quantity: number;
  createdAt: string;
  invoice: { id: string; amount: string; status: string; dueAt: string };
  wallet: { shopId: string; shop: { name: string } };
}

/**
 * Services à la carte (14 oct. 2026, plan commercial) — crédits IA et
 * SMS/WhatsApp premium. Le SMS/WhatsApp premium n'est qu'un
 * interrupteur + tarif affichés ici : aucune fonctionnalité réelle n'y est
 * encore branchée (pas de compte Twilio/WhatsApp Business), voir le
 * commentaire sur PlatformSettings.smsWhatsappPremiumEnabled dans
 * schema.prisma.
 */
function TarifsServicesALaCarteSection() {
  const [prixCredit, setPrixCredit] = useState("");
  const [smsActif, setSmsActif] = useState(false);
  const [smsTarif, setSmsTarif] = useState("");
  const [chargementTarifs, setChargementTarifs] = useState(true);
  const [enCoursTarifs, setEnCoursTarifs] = useState(false);

  const [services, setServices] = useState<AiService[]>([]);
  const [chargementServices, setChargementServices] = useState(true);
  const [nomService, setNomService] = useState("");
  const [coutService, setCoutService] = useState("");
  const [enCoursService, setEnCoursService] = useState(false);

  const [topUps, setTopUps] = useState<AiCreditTopUpAdmin[]>([]);
  const [chargementTopUps, setChargementTopUps] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function rechargerTarifs() {
    api
      .get<{
        aiCreditUnitPrice: string | null;
        smsWhatsappPremiumEnabled: boolean;
        smsWhatsappPremiumMonthlyFee: string | null;
      }>("/admin/platform-settings")
      .then((s) => {
        setPrixCredit(s.aiCreditUnitPrice ?? "");
        setSmsActif(s.smsWhatsappPremiumEnabled);
        setSmsTarif(s.smsWhatsappPremiumMonthlyFee ?? "");
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargementTarifs(false));
  }

  function rechargerServices() {
    api
      .get<AiService[]>("/admin/ai-credits/services")
      .then(setServices)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargementServices(false));
  }

  function rechargerTopUps() {
    api
      .get<AiCreditTopUpAdmin[]>("/admin/ai-credits/top-ups")
      .then(setTopUps)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargementTopUps(false));
  }

  useEffect(() => {
    rechargerTarifs();
    rechargerServices();
    rechargerTopUps();
  }, []);

  async function enregistrerTarifs() {
    setEnCoursTarifs(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.patch("/admin/platform-settings", {
        aiCreditUnitPrice: prixCredit ? Number(prixCredit) : null,
        smsWhatsappPremiumEnabled: smsActif,
        smsWhatsappPremiumMonthlyFee: smsTarif ? Number(smsTarif) : null,
      });
      setMessage("Tarifs des services à la carte enregistrés.");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCoursTarifs(false);
    }
  }

  async function creerService(e: React.FormEvent) {
    e.preventDefault();
    setEnCoursService(true);
    setErreur(null);
    try {
      await api.post("/admin/ai-credits/services", {
        name: nomService,
        creditCost: Number(coutService),
      });
      setNomService("");
      setCoutService("");
      rechargerServices();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCoursService(false);
    }
  }

  async function basculerServiceActif(service: AiService) {
    setErreur(null);
    try {
      await api.patch(`/admin/ai-credits/services/${service.id}`, { active: !service.active });
      rechargerServices();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    }
  }

  async function marquerPaye(invoiceId: string) {
    setActionEnCours(invoiceId);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ balanceGranted: number }>(
        `/admin/ai-credits/top-ups/${invoiceId}/mark-paid`,
        {},
      );
      setMessage(`Facture marquée payée — ${resultat.balanceGranted} crédit(s) accordé(s).`);
      rechargerTopUps();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  }

  const topUpsEnAttente = topUps.filter((t) => t.invoice.status === "PENDING");

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>Crédits IA</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Une boutique demande un certain nombre de crédits ; la facture correspondante (au prix unitaire
        ci-dessous, figé au moment de la demande) doit être marquée payée ici pour que les crédits soient
        accordés — jamais automatiquement. Le coût en crédits de chaque service IA se règle dans le
        catalogue ci-dessous.
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {!chargementTarifs && (
        <div className={styles.planChamps}>
          <label className={styles.champ}>
            <span>Prix d&apos;un crédit (USD, vide = achat indisponible)</span>
            <input placeholder="ex. 0.10" value={prixCredit} onChange={(e) => setPrixCredit(e.target.value)} />
          </label>
        </div>
      )}
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCoursTarifs} onClick={enregistrerTarifs}>
          Enregistrer le prix du crédit
        </button>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Catalogue des services IA</span>
        {chargementServices ? (
          <p style={{ fontSize: "0.875rem" }}>Chargement…</p>
        ) : (
          <>
            {services.length === 0 && <p className={styles.messageVide}>Aucun service IA configuré.</p>}
            {services.map((service) => (
              <div
                key={service.id}
                style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.875rem", padding: "4px 0" }}
              >
                <span style={{ flex: 1 }}>
                  {service.name} — {service.creditCost} crédit(s)
                  {!service.active && " (désactivé)"}
                </span>
                <button className={styles.boutonBasculer} onClick={() => basculerServiceActif(service)}>
                  {service.active ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            ))}
          </>
        )}
        <form onSubmit={creerService} className={styles.nouveauPlan} style={{ marginTop: 8 }}>
          <input
            placeholder="Nom du service (ex. Génération de visuel publicitaire)"
            value={nomService}
            onChange={(e) => setNomService(e.target.value)}
            required
          />
          <input
            placeholder="Coût en crédits"
            value={coutService}
            onChange={(e) => setCoutService(e.target.value)}
            required
          />
          <button className={styles.boutonEnregistrer} type="submit" disabled={enCoursService}>
            Ajouter un service
          </button>
        </form>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          Demandes d&apos;achat de crédits en attente de paiement
        </span>
        {chargementTopUps ? (
          <p style={{ fontSize: "0.875rem" }}>Chargement…</p>
        ) : topUpsEnAttente.length === 0 ? (
          <p className={styles.messageVide}>Aucune demande en attente.</p>
        ) : (
          topUpsEnAttente.map((t) => (
            <div
              key={t.id}
              style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.875rem", padding: "4px 0" }}
            >
              <span style={{ flex: 1 }}>
                {t.wallet.shop.name} — {t.quantity} crédit(s), {t.invoice.amount} $
              </span>
              <button
                className={styles.boutonEnregistrer}
                disabled={actionEnCours !== null}
                onClick={() => marquerPaye(t.invoice.id)}
              >
                Marquer payée
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.planEntete} style={{ borderTop: "1px solid var(--color-bordure)" }}>
        <span className={styles.planNom}>SMS / WhatsApp premium</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        Préparation du tarif uniquement — aucun envoi réel n&apos;est encore branché (aucun compte
        Twilio/WhatsApp Business configuré). Permet d&apos;afficher le prix dès maintenant.
      </p>
      <div className={styles.planChamps}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
          <input type="checkbox" checked={smsActif} onChange={(e) => setSmsActif(e.target.checked)} />
          Afficher l&apos;offre SMS/WhatsApp premium
        </label>
        <label className={styles.champ}>
          <span>Tarif mensuel (USD)</span>
          <input placeholder="ex. 10" value={smsTarif} onChange={(e) => setSmsTarif(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCoursTarifs} onClick={enregistrerTarifs}>
          Enregistrer le tarif SMS/WhatsApp
        </button>
      </div>
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

      <h2 className={styles.sectionTitre}>Bouquets ELEGANZ Mon Comptable</h2>
      <BouquetsComptableSection />

      <h2 className={styles.sectionTitre}>Taux de change</h2>
      <TauxChangeSection />

      <h2 className={styles.sectionTitre}>Services à la carte</h2>
      <TarifsServicesALaCarteSection />
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
