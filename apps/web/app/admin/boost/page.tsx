"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { formatMoney, formatDate } from "../../lib/money";
import styles from "./page.module.css";

type BoostCible = "BOUTIQUE" | "PRODUIT" | "COLLECTION" | "SOCIAL_360";
type BoostCanal = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "GOOGLE" | "X";
type BoostStatus = "EN_ATTENTE_PAIEMENT" | "ACTIF" | "EXPIRE" | "ANNULE";

const FAMILLES: BoostCible[] = ["PRODUIT", "COLLECTION", "BOUTIQUE", "SOCIAL_360"];
const CANAUX: BoostCanal[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "GOOGLE", "X"];

// Noms de marque — jamais traduits d'une langue à l'autre, même convention
// que "Mobile Money"/"WhatsApp" déjà utilisés tels quels ailleurs dans
// translations.ts.
const LIBELLE_CANAL: Record<BoostCanal, string> = {
  FACEBOOK: "Facebook Ads",
  INSTAGRAM: "Instagram Ads",
  TIKTOK: "TikTok Ads",
  GOOGLE: "Google Ads",
  X: "X Ads",
};

function cleFamille(cible: BoostCible): string {
  if (cible === "PRODUIT") return "boost_cibleArticle";
  if (cible === "COLLECTION") return "boost_cibleCollection";
  if (cible === "SOCIAL_360") return "boost_cibleSocial360";
  return "boost_cibleBoutique";
}

const CLES_STATUT_BOOST: Record<BoostStatus, string> = {
  EN_ATTENTE_PAIEMENT: "boost_statutEnAttentePaiement",
  ACTIF: "boost_statutActif",
  EXPIRE: "boost_statutExpire",
  ANNULE: "boost_statutAnnule",
};

// Même convention que Plan.featuresJson dans admin/tarifs/page.tsx : une
// matrice de fonctionnalités libre, éditée comme texte "clé" ou "clé: valeur"
// séparé par des virgules — jamais un champ figé dans le code, cohérent avec
// le reste du Centre de pilotage.
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
      const [cle, valeurBrute] = entree.split(":").map((s) => s.trim());
      if (valeurBrute === undefined) {
        features[cle] = true;
      } else {
        const nombre = Number(valeurBrute);
        features[cle] = Number.isFinite(nombre) && valeurBrute !== "" ? nombre : valeurBrute;
      }
    });
  return features;
}

interface BoostTarifAdmin {
  id: string;
  cible: BoostCible;
  nom: string;
  ordre: number;
  dureeJours: number;
  prixUSD: string;
  prixCDF: string | null;
  maxProduits: number | null;
  featuresJson: Record<string, unknown>;
  actif: boolean;
}

interface BoostEnCours {
  id: string;
  cible: BoostCible;
  status: BoostStatus;
  dureeJours: number;
  montant: string;
  remiseAppliqueePct: string | null;
  canauxJson: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  shop: { id: string; name: string };
  product: { id: string; name: string } | null;
  boostProduits: { product: { id: string; name: string } }[];
  tarif: { nom: string } | null;
}

interface PlatformSettingsBoost {
  boostPlafondSponsoriseResultatsPct: number;
  boostCreditLancementNouvelleBoutiqueUSD: string | number;
  boostRemisePremierBoostPct: number;
  boostRemisePremierBoostPlafondUSD: string | number | null;
  boostTauxChargesDirectesPct: number;
}

interface BoostCanalConfigAdmin {
  id: string;
  canal: BoostCanal;
  connecte: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  accountId: string | null;
  notes: string | null;
}

interface BoostCoutExterneAdmin {
  id: string;
  canal: BoostCanal;
  periode: string;
  montantUSD: string;
  note: string | null;
  createdAt: string;
}

interface RapportRentabilite {
  periode: { from: string; to: string };
  revenuTotal: number;
  revenuParFamille: Record<string, number>;
  coutsExternesTotal: number;
  tauxChargesDirectesPct: number;
  margeEstimee: number;
  nombreBoostsPayes: number;
}

/**
 * Un palier de tarif Boost, éditable en place (26 nov. 2026, demande
 * propriétaire ; étendu le 27 nov. 2026, refonte ELEGANZ BOOST) — même
 * structure que LigneBouquetComptable : 100 % paramétrable depuis cet écran,
 * aucune valeur figée dans le code (voir BoostTarifsService, dont le seed de
 * départ n'est jamais réécrit si le tarif existe déjà).
 */
function LigneBoostTarif({ tarif, onChange }: { tarif: BoostTarifAdmin; onChange: () => void }) {
  const { t } = useLocale();
  const [nom, setNom] = useState(tarif.nom);
  const [ordre, setOrdre] = useState(String(tarif.ordre));
  const [dureeJours, setDureeJours] = useState(String(tarif.dureeJours));
  const [prixUSD, setPrixUSD] = useState(tarif.prixUSD);
  const [prixCDF, setPrixCDF] = useState(tarif.prixCDF ?? "");
  const [maxProduits, setMaxProduits] = useState(tarif.maxProduits != null ? String(tarif.maxProduits) : "");
  const [features, setFeatures] = useState(featuresToTexte(tarif.featuresJson));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/billing/boost-tarifs/${tarif.id}`, {
        nom,
        ordre: Number(ordre),
        dureeJours: Number(dureeJours),
        prixUSD: Number(prixUSD),
        prixCDF: prixCDF === "" ? null : Number(prixCDF),
        maxProduits: maxProduits === "" ? null : Number(maxProduits),
        featuresJson: texteToFeatures(features),
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
      await api.patch(`/admin/billing/boost-tarifs/${tarif.id}`, { actif: !tarif.actif });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={`${styles.plan} ${!tarif.actif ? styles.planInactif : ""}`}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>
          {tarif.nom} — {tarif.dureeJours} j
        </span>
        <span className={styles.planStatut}>{tarif.actif ? t("eq_statutActif") : t("eq_statutDesactive")}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admboost_nom")}</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_ordre")}</span>
          <input value={ordre} onChange={(e) => setOrdre(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_duree")}</span>
          <input value={dureeJours} onChange={(e) => setDureeJours(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_prix")}</span>
          <input value={prixUSD} onChange={(e) => setPrixUSD(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_prixCDF")}</span>
          <input value={prixCDF} onChange={(e) => setPrixCDF(e.target.value)} />
        </label>
        {(tarif.cible === "COLLECTION" || tarif.cible === "BOUTIQUE") && (
          <label className={styles.champ}>
            <span>{t("admboost_maxProduits")}</span>
            <input value={maxProduits} onChange={(e) => setMaxProduits(e.target.value)} />
          </label>
        )}
        <label className={styles.champLarge}>
          <span>{t("admboost_featuresJson")}</span>
          <textarea value={features} onChange={(e) => setFeatures(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("action_enregistrer")}
        </button>
        <button className={styles.boutonBasculer} disabled={enCours} onClick={basculerActif}>
          {tarif.actif ? t("gliv_desactiver") : t("gliv_reactiver")}
        </button>
      </div>
    </div>
  );
}

function FormulaireNouveauBoostTarif({ cible, onCree }: { cible: BoostCible; onCree: () => void }) {
  const { t } = useLocale();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState("0");
  const [dureeJours, setDureeJours] = useState("");
  const [prixUSD, setPrixUSD] = useState("");
  const [prixCDF, setPrixCDF] = useState("");
  const [maxProduits, setMaxProduits] = useState("");
  const [features, setFeatures] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/admin/billing/boost-tarifs", {
        cible,
        nom,
        ordre: Number(ordre || 0),
        dureeJours: Number(dureeJours),
        prixUSD: Number(prixUSD),
        prixCDF: prixCDF === "" ? undefined : Number(prixCDF),
        maxProduits: maxProduits === "" ? undefined : Number(maxProduits),
        featuresJson: texteToFeatures(features),
      });
      setNom("");
      setOrdre("0");
      setDureeJours("");
      setPrixUSD("");
      setPrixCDF("");
      setMaxProduits("");
      setFeatures("");
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
        {t("admboost_ajouterTarif")}
      </button>
    );
  }

  return (
    <form className={styles.nouveauPlan} onSubmit={creer}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <input placeholder={t("admboost_nom")} value={nom} onChange={(e) => setNom(e.target.value)} required />
      <input placeholder={t("admboost_ordre")} value={ordre} onChange={(e) => setOrdre(e.target.value)} />
      <input placeholder={t("admboost_duree")} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)} required />
      <input placeholder={t("admboost_prix")} value={prixUSD} onChange={(e) => setPrixUSD(e.target.value)} required />
      <input placeholder={t("admboost_prixCDF")} value={prixCDF} onChange={(e) => setPrixCDF(e.target.value)} />
      {(cible === "COLLECTION" || cible === "BOUTIQUE") && (
        <input placeholder={t("admboost_maxProduits")} value={maxProduits} onChange={(e) => setMaxProduits(e.target.value)} />
      )}
      <input
        placeholder={t("admboost_featuresJson")}
        value={features}
        onChange={(e) => setFeatures(e.target.value)}
        style={{ minWidth: 260 }}
      />
      <button className={styles.boutonEnregistrer} type="submit" disabled={enCours}>
        {t("action_creer")}
      </button>
      <button type="button" className={styles.boutonBasculer} onClick={() => setOuvert(false)}>
        {t("action_annuler")}
      </button>
    </form>
  );
}

/**
 * Tarification Boost, regroupée par famille (27 nov. 2026, refonte ELEGANZ
 * BOOST) — une sous-section par cible (PRODUIT/COLLECTION/BOUTIQUE/
 * SOCIAL_360), chacune avec son propre formulaire d'ajout (la famille ne se
 * change pas après coup, elle détermine quels champs ont un sens — ex.
 * maxProduits pour COLLECTION, featuresJson-canaux pour SOCIAL_360).
 */
function BoostTarifsSection() {
  const { t } = useLocale();
  const [tarifs, setTarifs] = useState<BoostTarifAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<BoostTarifAdmin[]>("/admin/billing/boost-tarifs")
      .then(setTarifs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>{t("admtarifs_chargementTarifs")}</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {tarifs.length === 0 && <p className={styles.messageVide}>{t("admboost_aucunTarif")}</p>}
      {FAMILLES.map((famille) => {
        const tarifsFamille = tarifs.filter((tf) => tf.cible === famille);
        return (
          <div key={famille}>
            <h3 className={styles.sousTitreFamille}>{t(cleFamille(famille))}</h3>
            {tarifsFamille.map((tf) => (
              <LigneBoostTarif key={tf.id} tarif={tf} onChange={recharger} />
            ))}
            <FormulaireNouveauBoostTarif cible={famille} onCree={recharger} />
          </div>
        );
      })}
    </div>
  );
}

function libelleCible(b: BoostEnCours, t: (cle: string) => string): string {
  if (b.cible === "PRODUIT") return b.product?.name ?? t("boost_cibleArticle");
  if (b.cible === "COLLECTION") {
    const noms = b.boostProduits.map((bp) => bp.product.name);
    return noms.length > 0 ? `${t("boost_articlesCollection")} (${noms.length}) : ${noms.join(", ")}` : t("boost_cibleCollection");
  }
  if (b.cible === "SOCIAL_360") {
    const canaux = (b.canauxJson ?? []) as BoostCanal[];
    return canaux.length > 0
      ? `${t("boost_canauxChoisis")} : ${canaux.map((c) => LIBELLE_CANAL[c] ?? c).join(", ")}`
      : t("boost_cibleSocial360");
  }
  return t("boost_cibleBoutique");
}

/**
 * Visibilité opérationnelle des boosts en cours + modération (26 nov. 2026 ;
 * étendu le 27 nov. 2026 pour les 4 familles) — au-delà du simple suivi de
 * revenu déjà assuré par admin/factures?kind=boost : qu'est-ce qui est
 * RÉELLEMENT boosté en ce moment, toutes boutiques confondues.
 */
function BoostsEnCoursSection() {
  const { t } = useLocale();
  const [boosts, setBoosts] = useState<BoostEnCours[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<BoostEnCours[]>("/admin/boost")
      .then(setBoosts)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function revoquer(boostId: string) {
    setEnCours(boostId);
    setErreur(null);
    try {
      await api.post(`/admin/boost/${boostId}/revoquer`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("admtarifs_chargementTarifs")}</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {boosts.length === 0 ? (
        <p className={styles.messageVide}>{t("admboost_aucunEnCours")}</p>
      ) : (
        boosts.map((b) => (
          <div key={b.id} className={styles.plan}>
            <div className={styles.planEntete}>
              <span className={styles.planNom}>
                {b.shop.name} — {libelleCible(b, t)}
              </span>
              <span className={styles.planStatut}>{t(CLES_STATUT_BOOST[b.status])}</span>
            </div>
            <div className={styles.planChamps}>
              <span>
                {t("admboost_duree")} : {b.dureeJours} j · {t("admboost_prix")} : {formatMoney(Number(b.montant))}
              </span>
              {b.remiseAppliqueePct != null && Number(b.remiseAppliqueePct) > 0 && (
                <span>
                  {t("boost_remiseAppliquee")} : {Number(b.remiseAppliqueePct).toFixed(1)}%
                </span>
              )}
              {b.startsAt && b.endsAt && (
                <span>
                  {formatDate(b.startsAt)} → {formatDate(b.endsAt)}
                </span>
              )}
            </div>
            {(b.status === "EN_ATTENTE_PAIEMENT" || b.status === "ACTIF") && (
              <div className={styles.planActions}>
                <button className={styles.boutonBasculer} disabled={enCours === b.id} onClick={() => revoquer(b.id)}>
                  {t("admboost_revoquer")}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Réglages Boost (27 nov. 2026) — emplacements/priorités, promotions de
 * lancement et taux de charges directes, tous servis par le même endpoint
 * générique /admin/platform-settings (voir AdminSettingsController :
 * MenuAdmin.BOOST y donne désormais accès, même logique que
 * PARAMETRES_PLATEFORME/TARIFS pour ne pas retirer un accès existant).
 */
function ReglagesBoostSection() {
  const { t } = useLocale();
  const [valeurs, setValeurs] = useState<PlatformSettingsBoost | null>(null);
  const [plafond, setPlafond] = useState("");
  const [credit, setCredit] = useState("");
  const [remisePct, setRemisePct] = useState("");
  const [remisePlafond, setRemisePlafond] = useState("");
  const [tauxCharges, setTauxCharges] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function recharger() {
    api
      .get<PlatformSettingsBoost>("/admin/platform-settings")
      .then((data) => {
        setValeurs(data);
        setPlafond(String(data.boostPlafondSponsoriseResultatsPct));
        setCredit(String(data.boostCreditLancementNouvelleBoutiqueUSD));
        setRemisePct(String(data.boostRemisePremierBoostPct));
        setRemisePlafond(data.boostRemisePremierBoostPlafondUSD != null ? String(data.boostRemisePremierBoostPlafondUSD) : "");
        setTauxCharges(String(data.boostTauxChargesDirectesPct));
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")));
  }

  useEffect(recharger, []);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch("/admin/platform-settings", {
        boostPlafondSponsoriseResultatsPct: Number(plafond),
        boostCreditLancementNouvelleBoutiqueUSD: Number(credit),
        boostRemisePremierBoostPct: Number(remisePct),
        boostRemisePremierBoostPlafondUSD: remisePlafond === "" ? undefined : Number(remisePlafond),
        boostTauxChargesDirectesPct: Number(tauxCharges),
      });
      setConfirmation(t("admboost_reglagesEnregistres"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  if (!valeurs) return <p>{t("admtarifs_chargementTarifs")}</p>;

  return (
    <div className={styles.plan}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {confirmation && <p className={styles.messageVide}>{confirmation}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admboost_plafondSponsorise")}</span>
          <input value={plafond} onChange={(e) => setPlafond(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_creditLancement")}</span>
          <input value={credit} onChange={(e) => setCredit(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_remisePremierBoostPct")}</span>
          <input value={remisePct} onChange={(e) => setRemisePct(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_remisePremierBoostPlafond")}</span>
          <input value={remisePlafond} onChange={(e) => setRemisePlafond(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_tauxChargesDirectes")}</span>
          <input value={tauxCharges} onChange={(e) => setTauxCharges(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("action_enregistrer")}
        </button>
      </div>
    </div>
  );
}

/**
 * Canaux publicitaires externes (27 nov. 2026, réponse Q1 du cadrage :
 * "Option 1 avec les options API déjà prévues... qu'on va connecter
 * seulement") — champs structurés prêts à être branchés à une vraie régie
 * plus tard, `connecte` reste une simple annotation manuelle de l'admin,
 * aucun appel réel n'est jamais déclenché par cet écran.
 */
function LigneCanal({ canal, config, onChange }: { canal: BoostCanal; config: BoostCanalConfigAdmin; onChange: () => void }) {
  const { t } = useLocale();
  const [connecte, setConnecte] = useState(config.connecte);
  const [apiKey, setApiKey] = useState(config.apiKey ?? "");
  const [apiSecret, setApiSecret] = useState(config.apiSecret ?? "");
  const [accountId, setAccountId] = useState(config.accountId ?? "");
  const [notes, setNotes] = useState(config.notes ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/boost/canaux/${canal}`, { connecte, apiKey, apiSecret, accountId, notes });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.plan}>
      <div className={styles.planEntete}>
        <span className={styles.planNom}>{LIBELLE_CANAL[canal]}</span>
        <span className={styles.planStatut}>{connecte ? t("eq_statutActif") : t("eq_statutDesactive")}</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <p className={styles.note}>{t("admboost_avisConnexion")}</p>
      <div className={styles.planChamps}>
        <label className={styles.ligneCoche}>
          <input type="checkbox" checked={connecte} onChange={(e) => setConnecte(e.target.checked)} />
          <span>{t("admboost_canalConnecte")}</span>
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_apiKey")}</span>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_apiSecret")}</span>
          <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} type="password" />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_accountId")}</span>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        </label>
        <label className={styles.champLarge}>
          <span>{t("admboost_notes")}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={enCours} onClick={enregistrer}>
          {t("action_enregistrer")}
        </button>
      </div>
    </div>
  );
}

function CanauxSection() {
  const { t } = useLocale();
  const [configs, setConfigs] = useState<BoostCanalConfigAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  function recharger() {
    api
      .get<BoostCanalConfigAdmin[]>("/admin/boost/canaux")
      .then(setConfigs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  if (chargement) return <p>{t("admtarifs_chargementTarifs")}</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {CANAUX.map((canal) => {
        const config = configs.find((c) => c.canal === canal);
        if (!config) return null;
        return <LigneCanal key={canal} canal={canal} config={config} onChange={recharger} />;
      })}
    </div>
  );
}

/**
 * Coûts externes — saisie manuelle faute de connexion réelle à une régie
 * publicitaire (voir CanauxSection ci-dessus) : alimente le rapport de
 * rentabilité ci-dessous (BoostAdminService.rapportRentabilite).
 */
function CoutsExternesSection() {
  const { t } = useLocale();
  const [couts, setCouts] = useState<BoostCoutExterneAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const [canal, setCanal] = useState<BoostCanal>("FACEBOOK");
  const [periode, setPeriode] = useState("");
  const [montantUSD, setMontantUSD] = useState("");
  const [note, setNote] = useState("");
  const [creation, setCreation] = useState(false);

  function recharger() {
    api
      .get<BoostCoutExterneAdmin[]>("/admin/boost/couts-externes")
      .then(setCouts)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setCreation(true);
    setErreur(null);
    try {
      await api.post("/admin/boost/couts-externes", { canal, periode, montantUSD: Number(montantUSD), note: note || undefined });
      setPeriode("");
      setMontantUSD("");
      setNote("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_creationImpossible"));
    } finally {
      setCreation(false);
    }
  }

  async function supprimer(id: string) {
    setEnCours(id);
    setErreur(null);
    try {
      await api.delete(`/admin/boost/couts-externes/${id}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admtarifs_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("admtarifs_chargementTarifs")}</p>;

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {couts.length === 0 ? (
        <p className={styles.messageVide}>{t("admboost_aucunCout")}</p>
      ) : (
        couts.map((c) => (
          <div key={c.id} className={styles.plan}>
            <div className={styles.planEntete}>
              <span className={styles.planNom}>
                {LIBELLE_CANAL[c.canal]} — {c.periode}
              </span>
              <span className={styles.planStatut}>{formatMoney(Number(c.montantUSD))}</span>
            </div>
            {c.note && <p className={styles.note}>{c.note}</p>}
            <div className={styles.planActions}>
              <button className={styles.boutonSupprimer} disabled={enCours === c.id} onClick={() => supprimer(c.id)}>
                {t("admboost_supprimer")}
              </button>
            </div>
          </div>
        ))
      )}
      <form className={styles.nouveauPlan} onSubmit={ajouter}>
        <select value={canal} onChange={(e) => setCanal(e.target.value as BoostCanal)}>
          {CANAUX.map((c) => (
            <option key={c} value={c}>
              {LIBELLE_CANAL[c]}
            </option>
          ))}
        </select>
        <input placeholder={t("admboost_periode")} value={periode} onChange={(e) => setPeriode(e.target.value)} required />
        <input placeholder={t("admboost_montantUSD")} value={montantUSD} onChange={(e) => setMontantUSD(e.target.value)} required />
        <input placeholder={t("admboost_note")} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className={styles.boutonEnregistrer} type="submit" disabled={creation}>
          {t("admboost_ajouterCout")}
        </button>
      </form>
    </div>
  );
}

/**
 * Rapport de rentabilité — revenu issu des seules factures Boost PAID,
 * coûts externes saisis manuellement nets, marge indicative seulement (voir
 * BoostAdminService.rapportRentabilite pour le détail du calcul).
 */
function RapportSection() {
  const { t } = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rapport, setRapport] = useState<RapportRentabilite | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    setChargement(true);
    setErreur(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    api
      .get<RapportRentabilite>(`/admin/boost/rapport${qs ? `?${qs}` : ""}`)
      .then(setRapport)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(charger, []);

  return (
    <div className={styles.plan}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={styles.planChamps}>
        <label className={styles.champ}>
          <span>{t("admboost_rapportDepuis")}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.champ}>
          <span>{t("admboost_rapportJusqua")}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className={styles.planActions}>
        <button className={styles.boutonEnregistrer} disabled={chargement} onClick={charger}>
          {t("admboost_rapportCalculer")}
        </button>
      </div>
      {rapport && (
        <div className={styles.rapportGrille}>
          <div className={styles.rapportChiffre}>
            <strong>{formatMoney(rapport.revenuTotal)}</strong>
            <span>{t("admboost_rapportRevenuTotal")}</span>
          </div>
          <div className={styles.rapportChiffre}>
            <strong>{formatMoney(rapport.coutsExternesTotal)}</strong>
            <span>{t("admboost_rapportCoutsExternes")}</span>
          </div>
          <div className={styles.rapportChiffre}>
            <strong>{formatMoney(rapport.margeEstimee)}</strong>
            <span>{t("admboost_rapportMarge")}</span>
          </div>
          <div className={styles.rapportChiffre}>
            <strong>{rapport.nombreBoostsPayes}</strong>
            <span>{t("admboost_rapportNombreBoosts")}</span>
          </div>
          <div className={styles.rapportChiffre}>
            <strong>
              {Object.entries(rapport.revenuParFamille)
                .map(([famille, montant]) => `${t(cleFamille(famille as BoostCible))} : ${formatMoney(montant)}`)
                .join(" · ") || "—"}
            </strong>
            <span>{t("admboost_rapportParFamille")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BoostContent() {
  const { t } = useLocale();
  return (
    <div>
      <h1 className={styles.titre}>{t("admboost_titrePage")}</h1>

      <h2 className={styles.sectionTitre}>{t("admboost_sectionTarifs")}</h2>
      <BoostTarifsSection />

      <h2 className={styles.sectionTitre}>{t("admboost_sectionEnCours")}</h2>
      <BoostsEnCoursSection />

      <h2 className={styles.sectionTitre}>{t("admboost_sectionReglages")}</h2>
      <ReglagesBoostSection />

      <h2 className={styles.sectionTitre}>{t("admboost_sectionCanaux")}</h2>
      <CanauxSection />

      <h2 className={styles.sectionTitre}>{t("admboost_sectionCoutsExternes")}</h2>
      <CoutsExternesSection />

      <h2 className={styles.sectionTitre}>{t("admboost_sectionRapport")}</h2>
      <RapportSection />
    </div>
  );
}

export default function AdminBoostPage() {
  return (
    <AdminShell>
      <BoostContent />
    </AdminShell>
  );
}
