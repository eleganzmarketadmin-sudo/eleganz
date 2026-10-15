"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
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
const CLES_FONCTIONNALITES_GESTION: { cle: string; cleTrad: string }[] = [
  { cle: "financeAvancee", cleTrad: "admtarifs_gestion_financeAvancee" },
  { cle: "immobilisations", cleTrad: "admtarifs_gestion_immobilisations" },
  { cle: "cloture", cleTrad: "admtarifs_gestion_cloture" },
  { cle: "tresorerie", cleTrad: "admtarifs_gestion_tresorerie" },
  { cle: "comptableExterne", cleTrad: "admtarifs_gestion_comptableExterne" },
  { cle: "variantesProduits", cleTrad: "admtarifs_gestion_variantesProduits" },
  { cle: "exportExcelPdf", cleTrad: "admtarifs_gestion_exportExcelPdf" },
  { cle: "comptabiliteSyscohada", cleTrad: "admtarifs_gestion_comptabiliteSyscohada" },
];

function LignePlan({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const { t } = useLocale();
  const estGestion = plan.category === "GESTION";
  const [ouvertureFee, setOuvertureFee] = useState(plan.openingFee);
  const [prix, setPrix] = useState(plan.monthlyPrice);
  const [maxProduits, setMaxProduits] = useState(plan.maxActiveProducts?.toString() ?? "");
  const [commission, setCommission] = useState(plan.commissionRate ?? "");
  const [features, setFeatures] = useState(featuresToTexte(plan.featuresJson));
  const [coches, setCoches] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CLES_FONCTIONNALITES_GESTION.map(({ cle }) => [cle, plan.featuresJson[cle] === true])),
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
            ...Object.fromEntries(CLES_FONCTIONNALITES_GESTION.map(({ cle }) => [cle, coches[cle] === true])),
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
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`${styles.plan} ${!plan.active ? styles.planInactif : ""}`}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{plan.name}</span>
        <span className={styles.planStatut}>{plan.active ? t("eq_statutActif") : t("eq_statutDesactive")}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admtarifs_fraisOuverture")}</span>
          <input value={ouvertureFee} onChange={(e) => setOuvertureFee(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_prixMensuel")}</span>
          <input value={prix} onChange={(e) => setPrix(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_articlesActifsMax")}</span>
          <input
            placeholder={t("admtarifs_illimite")}
            value={maxProduits}
            onChange={(e) => setMaxProduits(e.target.value)}
          />
        </label>
        {estGestion && (
          <label className={styles.champ}>
            <span>{t("admtarifs_tailleEquipeMax")}</span>
            <input placeholder={t("admtarifs_illimite")} value={maxEquipe} onChange={(e) => setMaxEquipe(e.target.value)} />
          </label>
        )}
        {!estGestion && (
          <label className={styles.champ}>
            <span>{t("admtarifs_commissionVentes")}</span>
            <input
              placeholder="ex. 5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </label>
        )}
        {!estGestion && (
          <label className={styles.champLarge}>
            <span>{t("admtarifs_fonctionnalitesIncluses")}</span>
            <input value={features} onChange={(e) => setFeatures(e.target.value)} />
          </label>
        )}
      </div>
      {estGestion && (
        <div className={styles.planChamps} style={{ flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{t("admtarifs_fonctionnalitesInclusesBouquet")}</span>
          {CLES_FONCTIONNALITES_GESTION.map(({ cle, cleTrad }) => (
            <label key={cle} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={coches[cle] === true}
                onChange={(e) => setCoches((c) => ({ ...c, [cle]: e.target.checked }))}
              />
              {t(cleTrad)}
            </label>
          ))}
        </div>
      )}
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("action_enregistrer")}
        </button>
        <button className={styles.boutonBasculer} disabled={enCours} onClick={basculerActif}>
          {plan.active ? t("gliv_desactiver") : t("gliv_reactiver")}
        </button>
      </div>
    </div>
  );
}

function FormulaireNouveauPlan({ onCree }: { onCree: () => void }) {
  const { t } = useLocale();
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
      setErreur(err instanceof ApiError ? err.message : t("cat_creationImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button className={styles.boutonNouveau} onClick={() => setOuvert(true)}>
        {t("admtarifs_nouveauBouquet")}
      </button>
    );
  }

  return (
    <form className={styles.nouveauPlan} onSubmit={creer}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <select value={category} onChange={(e) => setCategory(e.target.value as "GESTION" | "MARKETPLACE")}>
        <option value="GESTION">{t("admtarifs_gestion")}</option>
        <option value="MARKETPLACE">{t("admtarifs_marketplace")}</option>
      </select>
      <input placeholder={t("admtarifs_nomBouquet")} value={name} onChange={(e) => setName(e.target.value)} required />
      <input
        placeholder={t("admtarifs_fraisOuvertureViderZero")}
        value={ouvertureFee}
        onChange={(e) => setOuvertureFee(e.target.value)}
      />
      <input
        placeholder={t("admtarifs_prixMensuel")}
        value={prix}
        onChange={(e) => setPrix(e.target.value)}
        required
      />
      <input
        placeholder={t("admtarifs_articlesActifsMaxVideIllimite")}
        value={maxProduits}
        onChange={(e) => setMaxProduits(e.target.value)}
      />
      {category === "MARKETPLACE" && (
        <input
          placeholder={t("admtarifs_commissionVentesTauxDefaut")}
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />
      )}
      <button className={styles.boutonEnregistrer} type="submit" disabled={enCours}>
        {t("action_creer")}
      </button>
      <button type="button" className={styles.boutonBasculer} onClick={() => setOuvert(false)}>
        {t("action_annuler")}
      </button>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)", flexBasis: "100%" }}>
        {t("admtarifs_noteFonctionnalitesApresCreation")}
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
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setMessage(t("admtarifs_livreur_tarifsEnregistres"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  async function declencher(libelleAction: string, chemin: string) {
    setActionEnCours(libelleAction);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${libelleAction} : ${resultat.length} ${t("admtarifs_livreur_concerne")}`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setActionEnCours(null);
    }
  }

  if (chargement) return <p>{t("admtarifs_livreur_chargementTarifs")}</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{t("admtarifs_livreur_titreSection")}</span>
      </div>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admtarifs_fraisOuvertureSouscription")}</span>
          <input value={ouvertureFee} onChange={(e) => setOuvertureFee(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_abonnementMensuel")}</span>
          <input value={mensuelFee} onChange={(e) => setMensuelFee(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_livreur_moisGratuiteValidation")}</span>
          <input value={moisGratuits} onChange={(e) => setMoisGratuits(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("admtarifs_enregistrerLesTarifs")}
        </button>
      </div>
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() =>
            declencher(t("admtarifs_verificationGratuitesEchues"), "/admin/driver-billing/run-trial-check")
          }
        >
          {t("admtarifs_verificationGratuitesEchues")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() =>
            declencher(t("admtarifs_facturationMensuelle"), "/admin/driver-billing/run-monthly-billing")
          }
        >
          {t("admtarifs_lancerFacturationMensuelle")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() =>
            declencher(t("admtarifs_suspensionImpayes"), "/admin/driver-billing/run-suspension-check")
          }
        >
          {t("admtarifs_livreur_suspendreImpaye")}
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
 * Fonctionnalités des bouquets Secourable (14 oct. 2026, proposition
 * validée par le propriétaire) — lues par ComptableService
 * (dashboardComparaison, dashboardHistorique, agenda) et ComptableController
 * (export/dossier-financement). Jamais une liste décorative, comme pour
 * FONCTIONNALITES_GESTION ci-dessus.
 */
const CLES_FONCTIONNALITES_COMPTABLE: { cle: string; cleTrad: string }[] = [
  { cle: "historiqueIllimite", cleTrad: "admtarifs_cpt_historiqueIllimite" },
  { cle: "comparaisonPeriodes", cleTrad: "admtarifs_cpt_comparaisonPeriodes" },
  { cle: "rappelsAgenda", cleTrad: "admtarifs_cpt_rappelsAgenda" },
  { cle: "exportDossierFinancement", cleTrad: "admtarifs_cpt_exportDossierFinancement" },
];

function LigneBouquetComptable({ bouquet, onChange }: { bouquet: ComptablePlan; onChange: () => void }) {
  const { t } = useLocale();
  const [mensuel, setMensuel] = useState(bouquet.monthlyPrice);
  const [annuel, setAnnuel] = useState(bouquet.yearlyPrice);
  const [maxActivites, setMaxActivites] = useState(bouquet.maxActivities?.toString() ?? "");
  const [coches, setCoches] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CLES_FONCTIONNALITES_COMPTABLE.map(({ cle }) => [cle, bouquet.featuresJson[cle] === true])),
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
        features: Object.fromEntries(CLES_FONCTIONNALITES_COMPTABLE.map(({ cle }) => [cle, coches[cle] === true])),
      });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`${styles.plan} ${!bouquet.active ? styles.planInactif : ""}`}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{bouquet.name}</span>
        <span className={styles.planStatut}>{bouquet.active ? t("eq_statutActif") : t("eq_statutDesactive")}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admtarifs_abonnementMensuel")}</span>
          <input value={mensuel} onChange={(e) => setMensuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_abonnementAnnuel")}</span>
          <input value={annuel} onChange={(e) => setAnnuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_cpt_activitesSimultaneesMax")}</span>
          <input placeholder={t("admtarifs_illimite")} value={maxActivites} onChange={(e) => setMaxActivites(e.target.value)} />
        </label>
      </div>
      <div className={styles.planChamps} style={{ flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{t("admtarifs_fonctionnalitesInclusesBouquet")}</span>
        {CLES_FONCTIONNALITES_COMPTABLE.map(({ cle, cleTrad }) => (
          <label key={cle} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
            <input
              type="checkbox"
              checked={coches[cle] === true}
              onChange={(e) => setCoches((c) => ({ ...c, [cle]: e.target.checked }))}
            />
            {t(cleTrad)}
          </label>
        ))}
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("action_enregistrer")}
        </button>
        <button className={styles.boutonBasculer} disabled={enCours} onClick={basculerActif}>
          {bouquet.active ? t("gliv_desactiver") : t("gliv_reactiver")}
        </button>
      </div>
    </div>
  );
}

function FormulaireNouveauBouquetComptable({ onCree }: { onCree: () => void }) {
  const { t } = useLocale();
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
      setErreur(err instanceof ApiError ? err.message : t("cat_creationImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button className={styles.boutonNouveau} onClick={() => setOuvert(true)}>
        {t("admtarifs_cpt_nouveauBouquet")}
      </button>
    );
  }

  return (
    <form className={styles.nouveauPlan} onSubmit={creer}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <input placeholder={t("admtarifs_nomBouquet")} value={nom} onChange={(e) => setNom(e.target.value)} required />
      <input placeholder={t("admtarifs_abonnementMensuel")} value={mensuel} onChange={(e) => setMensuel(e.target.value)} required />
      <input placeholder={t("admtarifs_abonnementAnnuel")} value={annuel} onChange={(e) => setAnnuel(e.target.value)} required />
      <input
        placeholder={t("admtarifs_activitesMaxVideIllimite")}
        value={maxActivites}
        onChange={(e) => setMaxActivites(e.target.value)}
      />
      <button className={styles.boutonEnregistrer} type="submit" disabled={enCours}>
        {t("action_creer")}
      </button>
      <button type="button" className={styles.boutonBasculer} onClick={() => setOuvert(false)}>
        {t("action_annuler")}
      </button>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)", flexBasis: "100%" }}>
        {t("admtarifs_noteFonctionnalitesApresCreationCourt")}
      </p>
    </form>
  );
}

/**
 * Bouquets ELEGANZ Secourable (14 oct. 2026, proposition validée par le
 * propriétaire — voir docs/PLAN_COMMERCIAL.md) : "Essentiel" reprend l'offre
 * actuelle à l'identique (jamais modifiée automatiquement), "Pro" et
 * "Premium" ajoutent de la valeur nouvelle. Entièrement gérable ici, sans
 * redéploiement — prix, limite d'activités, fonctionnalités.
 */
function BouquetsComptableSection() {
  const { t } = useLocale();
  const [bouquets, setBouquets] = useState<ComptablePlan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<ComptablePlan[]>("/admin/comptable/plans")
      .then(setBouquets)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>{t("admtarifs_cpt_chargementBouquets")}</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {bouquets.length === 0 && <p className={styles.messageVide}>{t("admtarifs_cpt_aucunBouquet")}</p>}
      {bouquets.map((b) => (
        <LigneBouquetComptable key={b.id} bouquet={b} onChange={recharger} />
      ))}
      <FormulaireNouveauBouquetComptable onCree={recharger} />
    </div>
  );
}

/**
 * Tarification d'ELEGANZ Secourable (prompt du 13 oct. 2026, §14) —
 * même découpage que TarifsLivreursSection : 6 mois gratuits dès la
 * première activation, puis une formule mensuelle ou annuelle, 100 %
 * paramétrables ici.
 */
function TarifsComptableSection() {
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setMessage(t("admtarifs_cpt_tarifsEnregistres"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  async function declencher(libelleAction: string, chemin: string) {
    setActionEnCours(libelleAction);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${libelleAction} : ${resultat.length} ${t("admtarifs_cpt_concerne")}`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setActionEnCours(null);
    }
  }

  if (chargement) return <p>{t("admtarifs_cpt_chargementTarifs")}</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{t("admtarifs_cpt_titreTarification")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_cpt_noteFiletSecurite")}
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admtarifs_cpt_abonnementMensuelSecours")}</span>
          <input value={mensuel} onChange={(e) => setMensuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_cpt_abonnementAnnuelSecours")}</span>
          <input value={annuel} onChange={(e) => setAnnuel(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_cpt_moisGratuitePremiereActivation")}</span>
          <input value={moisGratuits} onChange={(e) => setMoisGratuits(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("admtarifs_enregistrerLesTarifs")}
        </button>
      </div>
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_verificationGratuitesEchues"), "/admin/comptable/run-trial-check")}
        >
          {t("admtarifs_verificationGratuitesEchues")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_cpt_facturationRenouvellement"), "/admin/comptable/run-renewal-billing")}
        >
          {t("admtarifs_cpt_lancerFacturationRenouvellement")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_suspensionImpayes"), "/admin/comptable/run-suspension-check")}
        >
          {t("admtarifs_cpt_suspendreComptesImpaye")}
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
 * livreurs/Secourable, tant qu'aucun planificateur n'est en place.
 */
function TarifsBoutiquesSection() {
  const { t } = useLocale();
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
      setMessage(t("admtarifs_boutiques_tauxDefautEnregistre"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCoursTaux(false);
    }
  }

  async function declencher(libelleAction: string, chemin: string) {
    setActionEnCours(libelleAction);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${libelleAction} : ${resultat.length} ${t("admtarifs_boutiques_concernee")}`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{t("admtarifs_boutiques_titreFacturation")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_boutiques_noteFraisOuverture")}
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planActions} style={{ flexWrap: "wrap" }}>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_verificationGratuitesEchues"), "/admin/billing/run-trial-check")}
        >
          {t("admtarifs_verificationGratuitesEchues")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_facturationMensuelle"), "/admin/billing/run-monthly-billing")}
        >
          {t("admtarifs_lancerFacturationMensuelle")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_suspensionImpayes"), "/admin/billing/run-suspension-check")}
        >
          {t("admtarifs_boutiques_suspendreBoutiquesImpaye")}
        </button>
      </div>

      <div className={styles.planEntete} style={{ borderTop: "1px solid var(--color-bordure)" }}>
        <span className={styles.planNom}>{t("admtarifs_boutiques_titreCommission")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_boutiques_noteCommission")}
      </p>
      {!chargementTaux && (
        <div className={styles.planChamps}>
          <label className={styles.champ}>
            <span>{t("admtarifs_boutiques_tauxCommissionDefaut")}</span>
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
          {t("admtarifs_boutiques_enregistrerTauxDefaut")}
        </button>
        <button
          className={styles.boutonBasculer}
          disabled={actionEnCours !== null}
          onClick={() => declencher(t("admtarifs_boutiques_facturationCommissions"), "/admin/billing/run-commission-billing")}
        >
          {t("admtarifs_boutiques_lancerFacturationCommissions")}
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
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setMessage(t("admtarifs_taux_tauxEnregistreMsg"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>{t("admtarifs_taux_chargement")}</p>;

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{t("admtarifs_taux_titre")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_taux_noteUnSeulTaux")}
      </p>
      {tauxActuel ? (
        <p style={{ padding: "0 16px", fontSize: "0.875rem" }}>
          {t("admtarifs_taux_tauxActuel")} <strong>1 USD = {tauxActuel} CDF</strong>
          {misAJourLe && ` — ${t("admtarifs_taux_misAJourLe")} ${new Date(misAJourLe).toLocaleString("fr-FR")}`}
        </p>
      ) : (
        <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-flamme)" }}>
          {t("admtarifs_taux_aucunTauxConfigure")}
        </p>
      )}
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admtarifs_taux_combienCdfPourUsd")}</span>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="ex. 2900" />
        </label>
      </div>
      {apercuValide && (
        <p style={{ padding: "0 16px", fontSize: "0.875rem", fontFamily: "var(--font-mono), monospace" }}>
          {t("admtarifs_taux_apercuAvantEnregistrement")} 1 USD = {valeur.toLocaleString("fr-FR")} CDF — 1 000 CDF ≈{" "}
          {(1000 / valeur).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} USD
        </p>
      )}
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours || !apercuValide} onClick={enregistrer}>
          {t("admtarifs_taux_enregistrerLeTaux")}
        </button>
      </div>
      {historique.length > 0 && (
        <details style={{ padding: "0 16px 16px" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.875rem" }}>{t("admtarifs_taux_historiqueChangements")}</summary>
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
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargementTarifs(false));
  }

  function rechargerServices() {
    api
      .get<AiService[]>("/admin/ai-credits/services")
      .then(setServices)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargementServices(false));
  }

  function rechargerTopUps() {
    api
      .get<AiCreditTopUpAdmin[]>("/admin/ai-credits/top-ups")
      .then(setTopUps)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setMessage(t("admtarifs_ia_tarifsALaCarteEnregistres"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("cat_creationImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
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
      setMessage(`${t("admtarifs_ia_facturePayee")} — ${resultat.balanceGranted} ${t("admtarifs_ia_creditAccorde")}`);
      rechargerTopUps();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setActionEnCours(null);
    }
  }

  const topUpsEnAttente = topUps.filter((tu) => tu.invoice.status === "PENDING");

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{t("admtarifs_ia_creditsIa")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_ia_noteCreditsIa")}
      </p>
      {message && <p style={{ padding: "0 16px", color: "var(--color-vert-paiement)" }}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {!chargementTarifs && (
        <div className={styles.planChamps}>
          <label className={styles.champ}>
            <span>{t("admtarifs_ia_prixUnCredit")}</span>
            <input placeholder="ex. 0.10" value={prixCredit} onChange={(e) => setPrixCredit(e.target.value)} />
          </label>
        </div>
      )}
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCoursTarifs} onClick={enregistrerTarifs}>
          {t("admtarifs_ia_enregistrerPrixCredit")}
        </button>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{t("admtarifs_ia_catalogueServices")}</span>
        {chargementServices ? (
          <p style={{ fontSize: "0.875rem" }}>{t("commun_chargement")}</p>
        ) : (
          <>
            {services.length === 0 && <p className={styles.messageVide}>{t("admtarifs_ia_aucunServiceConfigure")}</p>}
            {services.map((service) => (
              <div
                key={service.id}
                style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.875rem", padding: "4px 0" }}
              >
                <span style={{ flex: 1 }}>
                  {service.name} — {service.creditCost} {t("admtarifs_ia_credits")}
                  {!service.active && ` (${t("eq_statutDesactive").toLowerCase()})`}
                </span>
                <button className={styles.boutonBasculer} onClick={() => basculerServiceActif(service)}>
                  {service.active ? t("gliv_desactiver") : t("gliv_reactiver")}
                </button>
              </div>
            ))}
          </>
        )}
        <form onSubmit={creerService} className={styles.nouveauPlan} style={{ marginTop: 8 }}>
          <input
            placeholder={t("admtarifs_ia_nomService")}
            value={nomService}
            onChange={(e) => setNomService(e.target.value)}
            required
          />
          <input
            placeholder={t("admtarifs_ia_coutEnCredits")}
            value={coutService}
            onChange={(e) => setCoutService(e.target.value)}
            required
          />
          <button className={styles.boutonEnregistrer} type="submit" disabled={enCoursService}>
            {t("admtarifs_ia_ajouterService")}
          </button>
        </form>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          {t("admtarifs_ia_demandesEnAttente")}
        </span>
        {chargementTopUps ? (
          <p style={{ fontSize: "0.875rem" }}>{t("commun_chargement")}</p>
        ) : topUpsEnAttente.length === 0 ? (
          <p className={styles.messageVide}>{t("admtarifs_ia_aucuneDemandeEnAttente")}</p>
        ) : (
          topUpsEnAttente.map((tu) => (
            <div
              key={tu.id}
              style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.875rem", padding: "4px 0" }}
            >
              <span style={{ flex: 1 }}>
                {tu.wallet.shop.name} — {tu.quantity} {t("admtarifs_ia_credits")}, {tu.invoice.amount} $
              </span>
              <button
                className={styles.boutonEnregistrer}
                disabled={actionEnCours !== null}
                onClick={() => marquerPaye(tu.invoice.id)}
              >
                {t("admtarifs_ia_marquerPayee")}
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.planEntete} style={{ borderTop: "1px solid var(--color-bordure)" }}>
        <span className={styles.planNom}>{t("admtarifs_sms_titre")}</span>
      </div>
      <p style={{ padding: "0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
        {t("admtarifs_sms_notePreparationTarif")}
      </p>
      <div className={styles.planChamps}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
          <input type="checkbox" checked={smsActif} onChange={(e) => setSmsActif(e.target.checked)} />
          {t("admtarifs_sms_afficherOffre")}
        </label>
        <label className={styles.champ}>
          <span>{t("admtarifs_sms_tarifMensuel")}</span>
          <input placeholder="ex. 10" value={smsTarif} onChange={(e) => setSmsTarif(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCoursTarifs} onClick={enregistrerTarifs}>
          {t("admtarifs_sms_enregistrerTarif")}
        </button>
      </div>
    </div>
  );
}

function TarifsContent() {
  const { t } = useLocale();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<Plan[]>("/admin/billing/plans")
      .then(setPlans)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>{t("admtarifs_chargementTarifs")}</p>;

  const gestion = plans.filter((p) => p.category === "GESTION");
  const marketplace = plans.filter((p) => p.category === "MARKETPLACE");

  return (
    <div>
      <h1 className={styles.titre}>{t("admtarifs_titrePage")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionBouquetsGestion")}</h2>
      {gestion.length === 0 && <p className={styles.messageVide}>{t("admtarifs_aucunBouquetGestion")}</p>}
      {gestion.map((plan) => (
        <LignePlan key={plan.id} plan={plan} onChange={recharger} />
      ))}

      <h2 className={styles.sectionTitre}>{t("admtarifs_marketplace")}</h2>
      {marketplace.length === 0 && <p className={styles.messageVide}>{t("admtarifs_aucunBouquetMarketplace")}</p>}
      {marketplace.map((plan) => (
        <LignePlan key={plan.id} plan={plan} onChange={recharger} />
      ))}

      <FormulaireNouveauPlan onCree={recharger} />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionFacturationBoutiques")}</h2>
      <TarifsBoutiquesSection />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionTarifsLivreurs")}</h2>
      <TarifsLivreursSection />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionTarifsSecourable")}</h2>
      <TarifsComptableSection />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionBouquetsSecourable")}</h2>
      <BouquetsComptableSection />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionTauxDeChange")}</h2>
      <TauxChangeSection />

      <h2 className={styles.sectionTitre}>{t("admtarifs_sectionServicesALaCarte")}</h2>
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
