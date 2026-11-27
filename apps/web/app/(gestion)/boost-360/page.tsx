"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

type BoostCible = "BOUTIQUE" | "PRODUIT" | "COLLECTION";
type BoostCanal = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "GOOGLE" | "X";
type StatutConnexion = "NON_CONNECTE" | "CONNECTE" | "EXPIRE" | "REVOQUE" | "ERREUR";
type StatutCampagneExterne =
  | "BROUILLON"
  | "EN_ATTENTE_CONNEXION"
  | "EN_ATTENTE_ENVOI"
  | "EN_ATTENTE_APPROBATION"
  | "APPROUVEE"
  | "REJETEE"
  | "DIFFUSION_EN_COURS"
  | "EN_PAUSE"
  | "TERMINEE"
  | "ERREUR";

const OBJETS: BoostCible[] = ["PRODUIT", "COLLECTION", "BOUTIQUE"];
const CANAUX: BoostCanal[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "GOOGLE", "X"];

// Noms de marque — jamais traduits, même convention que le Centre de
// pilotage (apps/web/app/admin/boost/page.tsx).
const LIBELLE_CANAL: Record<BoostCanal, string> = {
  FACEBOOK: "Facebook Ads",
  INSTAGRAM: "Instagram Ads",
  TIKTOK: "TikTok Ads",
  GOOGLE: "Google Ads",
  X: "X Ads",
};

function cleObjet(cible: BoostCible): string {
  if (cible === "PRODUIT") return "boost_cibleArticle";
  if (cible === "COLLECTION") return "boost_cibleCollection";
  return "boost_cibleBoutique";
}

const CLE_STATUT_CONNEXION: Record<StatutConnexion, string> = {
  NON_CONNECTE: "boost360_connexionNonConnecte",
  CONNECTE: "boost360_connexionConnecte",
  EXPIRE: "boost360_connexionExpire",
  REVOQUE: "boost360_connexionRevoque",
  ERREUR: "boost360_connexionErreur",
};

const HUMEUR_STATUT_CONNEXION: Record<StatutConnexion, "paye" | "attente" | "alerte" | "neutre"> = {
  NON_CONNECTE: "neutre",
  CONNECTE: "paye",
  EXPIRE: "alerte",
  REVOQUE: "neutre",
  ERREUR: "alerte",
};

const CLE_STATUT_CAMPAGNE: Record<StatutCampagneExterne, string> = {
  BROUILLON: "boost360_statutCampagne_BROUILLON",
  EN_ATTENTE_CONNEXION: "boost360_statutCampagne_EN_ATTENTE_CONNEXION",
  EN_ATTENTE_ENVOI: "boost360_statutCampagne_EN_ATTENTE_ENVOI",
  EN_ATTENTE_APPROBATION: "boost360_statutCampagne_EN_ATTENTE_APPROBATION",
  APPROUVEE: "boost360_statutCampagne_APPROUVEE",
  REJETEE: "boost360_statutCampagne_REJETEE",
  DIFFUSION_EN_COURS: "boost360_statutCampagne_DIFFUSION_EN_COURS",
  EN_PAUSE: "boost360_statutCampagne_EN_PAUSE",
  TERMINEE: "boost360_statutCampagne_TERMINEE",
  ERREUR: "boost360_statutCampagne_ERREUR",
};

const HUMEUR_STATUT_CAMPAGNE: Record<StatutCampagneExterne, "paye" | "attente" | "alerte" | "neutre"> = {
  BROUILLON: "neutre",
  EN_ATTENTE_CONNEXION: "attente",
  EN_ATTENTE_ENVOI: "attente",
  EN_ATTENTE_APPROBATION: "attente",
  APPROUVEE: "paye",
  REJETEE: "alerte",
  DIFFUSION_EN_COURS: "paye",
  EN_PAUSE: "neutre",
  TERMINEE: "neutre",
  ERREUR: "alerte",
};

interface FeaturesBoost360 {
  boostExterneActif: boolean;
  boostExterneFraisPct: number;
  boostExterneFraisMinimumUSD: string | number;
  boostExterneAudienceGeoParDefaut: string;
}

interface Connexion {
  id: string;
  canal: BoostCanal;
  statut: StatutConnexion;
  compteExterneNom: string | null;
  connectedAt: string | null;
  derniereErreur: string | null;
}

interface ProduitPublie {
  id: string;
  name: string;
  isPublished: boolean;
}

interface CampagneUnitaire {
  id: string;
  canal: BoostCanal;
  statut: StatutCampagneExterne;
  budgetAlloueUSD: string;
  statsImpressions: number | null;
  statsClics: number | null;
  statsPortee: number | null;
  statsDepenseUSD: string | null;
  derniereErreur: string | null;
}

interface GroupeCampagne {
  id: string;
  cible: BoostCible;
  product: { id: string; name: string } | null;
  boostExterneProduits: { product: { id: string; name: string } }[];
  dateDebut: string;
  dateFin: string;
  budgetTotalUSD: string;
  audienceGeo: string;
  fraisEleganzUSD: string;
  invoice: { id: string; status: string; dueAt: string; paidAt: string | null };
  campagnes: CampagneUnitaire[];
  createdAt: string;
}

function arrondi2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * ELEGANZ BOOST 360° (27 nov. 2026, demande propriétaire — maquette
 * "Simulation de l'interface vendeur" fournie) — assistant permettant à une
 * boutique de lancer une vraie publicité externe (Facebook/Instagram/
 * TikTok/Google/X) sans quitter ELEGANZ ni maîtriser l'outil publicitaire du
 * réseau. Distinct du Boost interne ((gestion)/boost/page.tsx, catalogue de
 * tarifs ELEGANZ) : ici, chaque boutique connecte et paie directement SON
 * PROPRE compte publicitaire (OAuth) — ELEGANZ ne gère ni ne débite jamais
 * le budget publicitaire, seuls ses frais de service (facture kind=
 * "boost_externe", réglée hors ligne comme le reste de la facturation)
 * déclenchent la transmission réelle de la campagne (voir
 * BoostExterneService.activerDepuisFacture côté API).
 */
function Boost360Content() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [features, setFeatures] = useState<FeaturesBoost360 | null>(null);
  const [connexions, setConnexions] = useState<Connexion[] | null>(null);
  const [produits, setProduits] = useState<ProduitPublie[] | null>(null);
  const [groupes, setGroupes] = useState<GroupeCampagne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [cible, setCible] = useState<BoostCible>("PRODUIT");
  const [productId, setProductId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [canauxChoisis, setCanauxChoisis] = useState<BoostCanal[]>([]);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [budgetTotalUSD, setBudgetTotalUSD] = useState("");
  const [audienceGeo, setAudienceGeo] = useState("");

  const [connexionEnCours, setConnexionEnCours] = useState<BoostCanal | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState<string | null>(null);
  const [actionCampagneEnCours, setActionCampagneEnCours] = useState<string | null>(null);

  const peutGerer = currentShop?.myRole === "OWNER";
  const peutPiloterCampagnes = currentShop?.myRole === "OWNER" || currentShop?.myRole === "MANAGER";

  function recharger() {
    if (!currentShop) return;
    api
      .get<Connexion[]>(`/shops/${currentShop.id}/boost-externe/connexions`)
      .then(setConnexions)
      .catch(() => setConnexions([]));
    api
      .get<ProduitPublie[]>(`/shops/${currentShop.id}/products`)
      .then(setProduits)
      .catch(() => setProduits([]));
    api
      .get<GroupeCampagne[]>(`/shops/${currentShop.id}/boost-externe/campagnes`)
      .then(setGroupes)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique")));
  }

  useEffect(() => {
    api
      .get<FeaturesBoost360>("/platform-settings/features", false)
      .then((d) => {
        setFeatures(d);
        setAudienceGeo((prev) => prev || d.boostExterneAudienceGeoParDefaut);
      })
      .catch(() => setFeatures(null));
  }, []);

  useEffect(recharger, [currentShop]);

  // Retour de la redirection OAuth (BoostExterneController.callbackOAuth) —
  // un seul affichage, puis on nettoie l'URL pour qu'un rechargement de page
  // ne répète pas le message.
  useEffect(() => {
    const connexionResultat = searchParams.get("connexion");
    const canalResultat = searchParams.get("canal") as BoostCanal | null;
    if (!connexionResultat) return;
    const libelle = canalResultat ? LIBELLE_CANAL[canalResultat] ?? canalResultat : "";
    if (connexionResultat === "reussie") {
      setMessage(t("boost360_connexionReussie").replace("{{canal}}", libelle));
    } else if (connexionResultat === "refusee") {
      setErreur(t("boost360_connexionRefusee").replace("{{canal}}", libelle));
    } else {
      setErreur(t("boost360_connexionEchec").replace("{{canal}}", libelle));
    }
    router.replace("/boost-360");
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const articlesPublies = (produits ?? []).filter((p) => p.isPublished);
  const connexionsParCanal = new Map((connexions ?? []).map((c) => [c.canal, c]));

  function changerCible(nouvelleCible: BoostCible) {
    setCible(nouvelleCible);
    setProductId("");
    setProductIds([]);
  }

  async function connecter(canal: BoostCanal) {
    if (!currentShop) return;
    setConnexionEnCours(canal);
    setErreur(null);
    try {
      const { url } = await api.post<{ url: string }>(`/shops/${currentShop.id}/boost-externe/connexions/${canal}/demarrer`);
      window.location.href = url;
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
      setConnexionEnCours(null);
    }
  }

  async function deconnecter(canal: BoostCanal) {
    if (!currentShop) return;
    setConnexionEnCours(canal);
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/boost-externe/connexions/${canal}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setConnexionEnCours(null);
    }
  }

  async function lancerCampagne() {
    if (!currentShop) return;
    setCreationEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.post(`/shops/${currentShop.id}/boost-externe/campagnes`, {
        cible,
        productId: cible === "PRODUIT" ? productId : undefined,
        productIds: cible === "COLLECTION" ? productIds : undefined,
        canaux: canauxChoisis,
        dateDebut,
        dateFin,
        budgetTotalUSD: Number(budgetTotalUSD),
        audienceGeo,
      });
      setMessage(t("boost360_campagneCreeConfirmation"));
      changerCible("PRODUIT");
      setCanauxChoisis([]);
      setDateDebut("");
      setDateFin("");
      setBudgetTotalUSD("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setCreationEnCours(false);
    }
  }

  async function annulerGroupe(groupeId: string) {
    if (!currentShop) return;
    setAnnulationEnCours(groupeId);
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/boost-externe/campagnes/${groupeId}`);
      setMessage(t("boost360_campagneAnnulee"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setAnnulationEnCours(null);
    }
  }

  async function pauser(campagneId: string) {
    if (!currentShop) return;
    setActionCampagneEnCours(campagneId);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/boost-externe/campagnes/unitaire/${campagneId}/pause`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setActionCampagneEnCours(null);
    }
  }

  async function reprendre(campagneId: string) {
    if (!currentShop) return;
    setActionCampagneEnCours(campagneId);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/boost-externe/campagnes/unitaire/${campagneId}/reprendre`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setActionCampagneEnCours(null);
    }
  }

  if (features === null || connexions === null || produits === null || groupes === null) {
    return <p className={styles.note}>{t("abonnement_chargement")}</p>;
  }

  if (!features.boostExterneActif) {
    return (
      <div>
        <h1 className={styles.titre}>{t("boost360_titre")}</h1>
        <p className={styles.messageVide}>{t("boost360_indisponible")}</p>
      </div>
    );
  }

  const budgetNombre = Number(budgetTotalUSD) || 0;
  const fraisCalcules = arrondi2((budgetNombre * features.boostExterneFraisPct) / 100);
  const fraisMinimum = Number(features.boostExterneFraisMinimumUSD);
  const fraisApercu = Math.max(fraisCalcules, fraisMinimum);

  const continuerDesactive =
    (cible === "PRODUIT" && !productId) ||
    (cible === "COLLECTION" && productIds.length === 0) ||
    canauxChoisis.length === 0 ||
    !dateDebut ||
    !dateFin ||
    !(new Date(dateFin).getTime() > new Date(dateDebut).getTime()) ||
    !(budgetNombre >= 1);

  return (
    <div>
      <h1 className={styles.titre}>{t("boost360_titre")}</h1>
      <p className={styles.intro}>{t("boost360_intro")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.confirmation}>{message}</p>}

      <h2 className={styles.sousTitre}>{t("boost360_sectionConnexions")}</h2>
      <div className={styles.grilleConnexions} style={{ marginBottom: "var(--espace-5)" }}>
        {CANAUX.map((canal) => {
          const connexion = connexionsParCanal.get(canal);
          const statut = connexion?.statut ?? "NON_CONNECTE";
          const estConnecte = statut === "CONNECTE";
          return (
            <div className={styles.carteConnexion} key={canal}>
              <div className={styles.carteConnexionEntete}>
                <span>{LIBELLE_CANAL[canal]}</span>
                <StatusTag label={t(CLE_STATUT_CONNEXION[statut])} humeur={HUMEUR_STATUT_CONNEXION[statut]} />
              </div>
              {connexion?.compteExterneNom && <span className={styles.note}>{connexion.compteExterneNom}</span>}
              {connexion?.derniereErreur && <span className={styles.erreur}>{connexion.derniereErreur}</span>}
              {peutGerer && (
                <button
                  className={styles.boutonSecondaire}
                  type="button"
                  disabled={connexionEnCours === canal}
                  onClick={() => (estConnecte ? deconnecter(canal) : connecter(canal))}
                >
                  {estConnecte ? t("boost360_boutonDeconnecter") : t("boost360_boutonConnecter")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {peutGerer && (
        <div className={styles.carte}>
          <h2 className={styles.sousTitre}>{t("boost360_sectionNouvelleCampagne")}</h2>

          <label className={styles.champ}>
            <span>{t("boost360_choisirObjet")}</span>
            <select value={cible} onChange={(e) => changerCible(e.target.value as BoostCible)}>
              {OBJETS.map((o) => (
                <option key={o} value={o}>
                  {t(cleObjet(o))}
                </option>
              ))}
            </select>
          </label>

          {cible === "PRODUIT" && (
            <label className={styles.champ}>
              <span>{t("boost_choisirArticle")}</span>
              {articlesPublies.length === 0 ? (
                <p className={styles.note}>{t("boost_aucunArticlePublie")}</p>
              ) : (
                <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="" disabled>
                    —
                  </option>
                  {articlesPublies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          {cible === "COLLECTION" && (
            <div className={styles.champ}>
              <span>{t("boost_choisirArticles")}</span>
              {articlesPublies.length === 0 ? (
                <p className={styles.note}>{t("boost_aucunArticlePublie")}</p>
              ) : (
                <div className={styles.listeCoches}>
                  {articlesPublies.map((p) => (
                    <label key={p.id} className={styles.ligneCoche}>
                      <input
                        type="checkbox"
                        checked={productIds.includes(p.id)}
                        onChange={(e) =>
                          setProductIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                        }
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.champ}>
            <span>{t("boost360_choisirReseaux")}</span>
            <div className={styles.listeCoches}>
              {CANAUX.map((c) => {
                const estConnecte = connexionsParCanal.get(c)?.statut === "CONNECTE";
                return (
                  <label key={c} className={styles.ligneCoche}>
                    <input
                      type="checkbox"
                      checked={canauxChoisis.includes(c)}
                      disabled={!estConnecte}
                      onChange={(e) =>
                        setCanauxChoisis((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))
                      }
                    />
                    <span>{LIBELLE_CANAL[c]}</span>
                    {!estConnecte && <span className={styles.note}> — {t("boost360_reseauNonConnecteAide")}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <label className={styles.champ}>
            <span>{t("boost360_dateDebut")}</span>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </label>
          <label className={styles.champ}>
            <span>{t("boost360_dateFin")}</span>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
          <label className={styles.champ}>
            <span>{t("boost360_budget")}</span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={budgetTotalUSD}
              onChange={(e) => setBudgetTotalUSD(e.target.value)}
            />
          </label>
          <label className={styles.champ}>
            <span>{t("boost360_audienceGeo")}</span>
            <input
              value={audienceGeo}
              maxLength={2}
              onChange={(e) => setAudienceGeo(e.target.value.toUpperCase())}
            />
          </label>

          {budgetNombre > 0 && (
            <p className={styles.note}>
              {t("boost360_fraisApercu")
                .replace("{{pct}}", String(features.boostExterneFraisPct))
                .replace("{{montant}}", fraisApercu.toFixed(2))}
            </p>
          )}

          <button
            className={styles.bouton}
            type="button"
            disabled={continuerDesactive || creationEnCours}
            onClick={lancerCampagne}
          >
            {creationEnCours ? t("abonnement_chargement") : t("boost360_boutonLancer")}
          </button>
        </div>
      )}

      <h2 className={styles.sousTitre} style={{ marginTop: "var(--espace-5)" }}>
        {t("boost360_sectionCampagnes")}
      </h2>
      {groupes.length === 0 ? (
        <p className={styles.messageVide}>{t("boost360_aucuneCampagne")}</p>
      ) : (
        groupes.map((g) => {
          const nomsArticles =
            g.cible === "PRODUIT" && g.product
              ? g.product.name
              : g.cible === "COLLECTION"
                ? g.boostExterneProduits.map((bp) => bp.product.name).join(", ")
                : t("boost_cibleBoutique");
          const fraisEnAttente = g.invoice.status === "PENDING";
          return (
            <div className={styles.ligneBoost} key={g.id}>
              <div className={styles.entete}>
                <span>
                  {t(cleObjet(g.cible))} — {nomsArticles}
                </span>
                <span className={styles.note}>
                  {formatDate(g.dateDebut)} → {formatDate(g.dateFin)}
                </span>
              </div>
              <div className={styles.detailsBoost}>
                <span>
                  {t("boost360_budget")} : {formatMoney(Number(g.budgetTotalUSD))} · {t("admboost_colFactureFrais")} :{" "}
                  {formatMoney(Number(g.fraisEleganzUSD))}
                </span>
                <span>{g.audienceGeo}</span>
              </div>
              {fraisEnAttente && <p className={styles.note}>{t("boost360_fraisEnAttente")}</p>}
              {g.campagnes.map((c) => (
                <div className={styles.campagneUnitaire} key={c.id}>
                  <div className={styles.entete}>
                    <span>{LIBELLE_CANAL[c.canal]}</span>
                    <StatusTag label={t(CLE_STATUT_CAMPAGNE[c.statut])} humeur={HUMEUR_STATUT_CAMPAGNE[c.statut]} />
                  </div>
                  <span className={styles.note}>
                    {t("boost360_colBudgetAlloue")} : {formatMoney(Number(c.budgetAlloueUSD))}
                    {c.statsImpressions != null &&
                      ` · ${c.statsImpressions} · ${c.statsClics ?? 0} · ${c.statsPortee ?? 0} · ${formatMoney(Number(c.statsDepenseUSD ?? 0))}`}
                  </span>
                  {c.derniereErreur && <span className={styles.erreur}>{c.derniereErreur}</span>}
                  {peutPiloterCampagnes && (c.statut === "DIFFUSION_EN_COURS" || c.statut === "EN_PAUSE") && (
                    <div className={styles.boutonsReglement}>
                      {c.statut === "DIFFUSION_EN_COURS" ? (
                        <button
                          className={styles.boutonSecondaire}
                          type="button"
                          disabled={actionCampagneEnCours === c.id}
                          onClick={() => pauser(c.id)}
                        >
                          {t("boost360_boutonPause")}
                        </button>
                      ) : (
                        <button
                          className={styles.boutonSecondaire}
                          type="button"
                          disabled={actionCampagneEnCours === c.id}
                          onClick={() => reprendre(c.id)}
                        >
                          {t("boost360_boutonReprendre")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {peutGerer && fraisEnAttente && (
                <div className={styles.boutonsReglement}>
                  <button
                    className={styles.boutonSecondaire}
                    type="button"
                    disabled={annulationEnCours === g.id}
                    onClick={() => annulerGroupe(g.id)}
                  >
                    {t("boost360_boutonAnnulerCampagne")}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function Boost360Page() {
  return (
    <ProtectedGestionPage>
      <Suspense fallback={null}>
        <Boost360Content />
      </Suspense>
    </ProtectedGestionPage>
  );
}
