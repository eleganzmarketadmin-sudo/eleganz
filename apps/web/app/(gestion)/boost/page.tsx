"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { BoutonBientotDisponible } from "../../components/BoutonBientotDisponible";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

type BoostCible = "BOUTIQUE" | "PRODUIT" | "COLLECTION" | "SOCIAL_360";
type BoostCanal = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "GOOGLE" | "X";
type BoostStatus = "EN_ATTENTE_PAIEMENT" | "ACTIF" | "EXPIRE" | "ANNULE";

const FAMILLES: BoostCible[] = ["PRODUIT", "COLLECTION", "BOUTIQUE", "SOCIAL_360"];
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

function cleFamille(cible: BoostCible): string {
  if (cible === "PRODUIT") return "boost_cibleArticle";
  if (cible === "COLLECTION") return "boost_cibleCollection";
  if (cible === "SOCIAL_360") return "boost_cibleSocial360";
  return "boost_cibleBoutique";
}

interface BoostTarif {
  id: string;
  cible: BoostCible;
  nom: string;
  dureeJours: number;
  prixUSD: string;
  prixCDF: string | null;
  maxProduits: number | null;
  featuresJson: Record<string, unknown>;
  actif: boolean;
}

interface ProduitPublie {
  id: string;
  name: string;
  isPublished: boolean;
}

interface ProduitRef {
  id: string;
  name: string;
}

interface Boost {
  id: string;
  cible: BoostCible;
  productId: string | null;
  product: ProduitRef | null;
  boostProduits: { product: ProduitRef }[];
  canauxJson: string[] | null;
  tarif: BoostTarif;
  dureeJours: number;
  montant: string;
  remiseAppliqueePct: string | null;
  status: BoostStatus;
  invoice: { id: string; status: string; dueAt: string; paidAt: string | null } | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const CLES_STATUT: Record<BoostStatus, string> = {
  EN_ATTENTE_PAIEMENT: "boost_statutEnAttentePaiement",
  ACTIF: "boost_statutActif",
  EXPIRE: "boost_statutExpire",
  ANNULE: "boost_statutAnnule",
};

const HUMEUR_STATUT: Record<BoostStatus, "paye" | "attente" | "alerte" | "neutre"> = {
  EN_ATTENTE_PAIEMENT: "attente",
  ACTIF: "paye",
  EXPIRE: "neutre",
  ANNULE: "neutre",
};

function libelleCible(b: Boost, t: (cle: string) => string): string {
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
 * Boost payant (26 nov. 2026, demande propriétaire ; étendu le 27 nov. 2026 —
 * refonte ELEGANZ BOOST à partir de la proposition de tarification fournie,
 * adaptée à l'architecture réelle) — une boutique paie pour mettre en avant
 * toute sa boutique, un article précis, PLUSIEURS articles choisis (famille
 * COLLECTION, bornée par tarif.maxProduits) ou une campagne multicanale
 * (famille SOCIAL_360, canaux limités à ceux inclus dans le palier choisi).
 * Règlement hors ligne (virement/Mobile Money), même pattern en deux temps
 * que FacturationElegansSection (apps/web/app/(gestion)/parametres/page.tsx) :
 * upload-url signée, PUT direct sur le stockage, puis confirmation — ici
 * réutilisé tel quel sur la facture liée au boost.
 *
 * L'achat engage la boutique financièrement : réservé à OWNER (même
 * restriction que le changement de bouquet Gestion), MANAGER peut
 * seulement consulter l'historique — confort de navigation, la vraie
 * barrière reste ShopRoles côté API.
 */
function BoostContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();

  const [tarifs, setTarifs] = useState<BoostTarif[] | null>(null);
  const [produits, setProduits] = useState<ProduitPublie[] | null>(null);
  const [boosts, setBoosts] = useState<Boost[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [cible, setCible] = useState<BoostCible>("PRODUIT");
  const [productId, setProductId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [canaux, setCanaux] = useState<BoostCanal[]>([]);
  const [tarifId, setTarifId] = useState("");
  const [etapeReglement, setEtapeReglement] = useState(false);
  const [achatEnCours, setAchatEnCours] = useState(false);

  const [noteParBoost, setNoteParBoost] = useState<Record<string, string>>({});
  const [preuveOuverte, setPreuveOuverte] = useState<string | null>(null);
  const [enCoursPreuve, setEnCoursPreuve] = useState<string | null>(null);
  const [annulationEnCours, setAnnulationEnCours] = useState<string | null>(null);

  const peutAcheter = currentShop?.myRole === "OWNER";

  function recharger() {
    if (!currentShop) return;
    api.get<BoostTarif[]>("/billing/boost-tarifs").then(setTarifs).catch(() => setTarifs([]));
    api
      .get<ProduitPublie[]>(`/shops/${currentShop.id}/products`)
      .then(setProduits)
      .catch(() => setProduits([]));
    api
      .get<Boost[]>(`/shops/${currentShop.id}/boosts`)
      .then(setBoosts)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique")));
  }

  useEffect(recharger, [currentShop]);

  const tarifsFiltres = (tarifs ?? []).filter((tf) => tf.cible === cible);
  const articlesPublies = (produits ?? []).filter((p) => p.isPublished);
  const tarifChoisi = tarifsFiltres.find((tf) => tf.id === tarifId) ?? null;
  const canauxDisponibles = tarifChoisi ? CANAUX.filter((c) => tarifChoisi.featuresJson?.[c] === true) : [];

  function changerCible(nouvelleCible: BoostCible) {
    setCible(nouvelleCible);
    setProductId("");
    setProductIds([]);
    setCanaux([]);
    setTarifId("");
  }

  function changerTarif(nouveauTarifId: string) {
    setTarifId(nouveauTarifId);
    setProductIds([]);
    setCanaux([]);
  }

  async function lancerAchat() {
    if (!currentShop || !tarifId) return;
    setAchatEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.post<Boost>(`/shops/${currentShop.id}/boosts`, {
        cible,
        productId: cible === "PRODUIT" ? productId : undefined,
        productIds: cible === "COLLECTION" ? productIds : undefined,
        canaux: cible === "SOCIAL_360" ? canaux : undefined,
        tarifId,
      });
      setMessage(t("boost_confirmeAchat"));
      setEtapeReglement(false);
      changerCible("PRODUIT");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setAchatEnCours(false);
    }
  }

  async function annuler(boostId: string) {
    if (!currentShop) return;
    setAnnulationEnCours(boostId);
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/boosts/${boostId}`);
      setMessage(t("boost_confirmeAnnule"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique"));
    } finally {
      setAnnulationEnCours(null);
    }
  }

  async function deposerPreuve(boostId: string, invoiceId: string, fichier: File) {
    if (!currentShop) return;
    setEnCoursPreuve(boostId);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/shops/${currentShop.id}/invoices/${invoiceId}/proof-of-payment/upload-url`,
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("factElg_erreurEnvoiStockage"));
      await api.post(`/shops/${currentShop.id}/invoices/${invoiceId}/proof-of-payment`, {
        fileUrl: publicUrl,
        note: noteParBoost[boostId] || undefined,
      });
      setMessage(t("factElg_preuveDeposee"));
      setPreuveOuverte(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("factElg_erreurEnvoiPreuve"));
    } finally {
      setEnCoursPreuve(null);
    }
  }

  if (tarifs === null || produits === null || boosts === null) {
    return <p className={styles.note}>{t("abonnement_chargement")}</p>;
  }

  const continuerDesactive =
    !tarifId ||
    (cible === "PRODUIT" && !productId) ||
    (cible === "COLLECTION" && productIds.length === 0) ||
    (cible === "SOCIAL_360" && canaux.length === 0);

  return (
    <div>
      <h1 className={styles.titre}>{t("boost_titre")}</h1>
      <p className={styles.intro}>{t("boost_intro")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.confirmation}>{message}</p>}

      {peutAcheter && (
        <div className={styles.carte}>
          <h2 className={styles.sousTitre}>{t("boost_sectionDemarrer")}</h2>

          {!etapeReglement ? (
            <>
              <label className={styles.champ}>
                <span>{t("boost_choisirCible")}</span>
                <select value={cible} onChange={(e) => changerCible(e.target.value as BoostCible)}>
                  {FAMILLES.map((f) => (
                    <option key={f} value={f}>
                      {t(cleFamille(f))}
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

              <label className={styles.champ}>
                <span>{t("boost_choisirForfait")}</span>
                {tarifsFiltres.length === 0 ? (
                  <p className={styles.note}>{t("boost_aucunTarif")}</p>
                ) : (
                  <select value={tarifId} onChange={(e) => changerTarif(e.target.value)}>
                    <option value="" disabled>
                      —
                    </option>
                    {tarifsFiltres.map((tf) => (
                      <option key={tf.id} value={tf.id}>
                        {t("boost_optionTarifNom")
                          .replace("{{nom}}", tf.nom)
                          .replace("{{jours}}", String(tf.dureeJours))
                          .replace("{{prix}}", formatMoney(Number(tf.prixUSD)))}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {cible === "COLLECTION" && tarifChoisi && (
                <div className={styles.champ}>
                  <span>{t("boost_choisirArticles")}</span>
                  {tarifChoisi.maxProduits != null && (
                    <p className={styles.note}>{t("boost_limiteArticles").replace("{{max}}", String(tarifChoisi.maxProduits))}</p>
                  )}
                  {articlesPublies.length === 0 ? (
                    <p className={styles.note}>{t("boost_aucunArticlePublie")}</p>
                  ) : (
                    <div className={styles.listeCoches}>
                      {articlesPublies.map((p) => {
                        const coche = productIds.includes(p.id);
                        const limiteAtteinte = tarifChoisi.maxProduits != null && productIds.length >= tarifChoisi.maxProduits;
                        return (
                          <label key={p.id} className={styles.ligneCoche}>
                            <input
                              type="checkbox"
                              checked={coche}
                              disabled={!coche && limiteAtteinte}
                              onChange={(e) =>
                                setProductIds((prev) =>
                                  e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                                )
                              }
                            />
                            <span>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {cible === "SOCIAL_360" && tarifChoisi && (
                <div className={styles.champ}>
                  <span>{t("boost_choisirCanaux")}</span>
                  {canauxDisponibles.length === 0 ? (
                    <p className={styles.note}>{t("boost_aucunCanalDisponible")}</p>
                  ) : (
                    <div className={styles.listeCoches}>
                      {canauxDisponibles.map((c) => (
                        <label key={c} className={styles.ligneCoche}>
                          <input
                            type="checkbox"
                            checked={canaux.includes(c)}
                            onChange={(e) =>
                              setCanaux((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))
                            }
                          />
                          <span>{LIBELLE_CANAL[c]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button className={styles.bouton} type="button" disabled={continuerDesactive} onClick={() => setEtapeReglement(true)}>
                {t("boost_continuer")}
              </button>
            </>
          ) : (
            <>
              <h3 className={styles.sousTitre}>{t("boost_modeReglement")}</h3>
              {tarifChoisi && (
                <p className={styles.note}>
                  {t("boost_optionTarifNom")
                    .replace("{{nom}}", tarifChoisi.nom)
                    .replace("{{jours}}", String(tarifChoisi.dureeJours))
                    .replace("{{prix}}", formatMoney(Number(tarifChoisi.prixUSD)))}
                </p>
              )}
              <div className={styles.boutonsReglement}>
                <button className={styles.bouton} type="button" disabled={achatEnCours} onClick={lancerAchat}>
                  {achatEnCours ? t("abonnement_chargement") : t("boost_virementMobileMoney")}
                </button>
                <BoutonBientotDisponible icone="💳" label={t("boost_paiementEnLigne")} />
              </div>
              <button className={styles.boutonSecondaire} type="button" onClick={() => setEtapeReglement(false)}>
                {t("boost_retour")}
              </button>
            </>
          )}
        </div>
      )}

      <h2 className={styles.sousTitre} style={{ marginTop: "var(--espace-5)" }}>
        {t("boost_historique")}
      </h2>
      {boosts.length === 0 ? (
        <p className={styles.messageVide}>{t("boost_aucunBoost")}</p>
      ) : (
        boosts.map((b) => {
          const enAttentePaiement = b.status === "EN_ATTENTE_PAIEMENT";
          const prixCatalogue = Number(b.tarif?.prixUSD ?? b.montant);
          return (
            <div className={styles.ligneBoost} key={b.id}>
              <div className={styles.entete}>
                <span>{libelleCible(b, t)}</span>
                <StatusTag label={t(CLES_STATUT[b.status])} humeur={HUMEUR_STATUT[b.status]} />
              </div>
              <div className={styles.detailsBoost}>
                <span>
                  {t("boost_colDuree")} : {b.dureeJours} j · {t("boost_colMontant")} : {formatMoney(Number(b.montant))}
                </span>
                {b.remiseAppliqueePct != null && Number(b.remiseAppliqueePct) > 0 && (
                  <span>
                    {t("boost_remiseAppliquee")} : {Number(b.remiseAppliqueePct).toFixed(1)}%
                  </span>
                )}
                {prixCatalogue !== Number(b.montant) && (
                  <span>
                    {t("boost_prixCatalogue")} : {formatMoney(prixCatalogue)}
                  </span>
                )}
                {b.startsAt && b.endsAt ? (
                  <span>
                    {formatDate(b.startsAt)} → {formatDate(b.endsAt)}
                  </span>
                ) : (
                  enAttentePaiement &&
                  b.invoice && (
                    <span>
                      {t("crd_colEcheance")} : {formatDate(b.invoice.dueAt)}
                    </span>
                  )
                )}
              </div>
              {enAttentePaiement && b.invoice && (
                <>
                  <div className={styles.boutonsReglement}>
                    <button
                      className={styles.boutonSecondaire}
                      type="button"
                      onClick={() => setPreuveOuverte(preuveOuverte === b.id ? null : b.id)}
                    >
                      📎 {t("factElg_deposerPreuve")}
                    </button>
                    {peutAcheter && (
                      <button
                        className={styles.boutonSecondaire}
                        type="button"
                        disabled={annulationEnCours === b.id}
                        onClick={() => annuler(b.id)}
                      >
                        {t("boost_annuler")}
                      </button>
                    )}
                  </div>
                  {preuveOuverte === b.id && (
                    <div className={styles.depotPreuve}>
                      <input
                        type="text"
                        placeholder={t("factElg_notePlaceholder")}
                        value={noteParBoost[b.id] ?? ""}
                        onChange={(e) => setNoteParBoost((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={enCoursPreuve === b.id}
                        onChange={(e) => {
                          const fichier = e.target.files?.[0];
                          if (fichier && b.invoice) deposerPreuve(b.id, b.invoice.id, fichier);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function BoostPage() {
  return (
    <ProtectedGestionPage>
      <BoostContent />
    </ProtectedGestionPage>
  );
}
