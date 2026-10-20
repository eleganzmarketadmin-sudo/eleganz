"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { RetourLien } from "../../../components/RetourLien";
import { PrixPromo, RubanPromo } from "../../../components/PrixPromo";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import { nomPays } from "../../../lib/i18n/nomPays";
import styles from "./page.module.css";

interface ZoneLivraison {
  id: string;
  country: { isoCode: string; name: string };
  city: { name: string };
}

interface Boutique {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  deliveryZones: ZoneLivraison[];
  nombreProduits: number;
  noteMoyenne: number | null;
  nombreAvis: number;
}

interface Variant {
  id: string;
  sellPrice: string;
  compareAtPrice?: string | null;
  currency: string;
  stockQty: number;
}

interface Produit {
  id: string;
  name: string;
  category?: string | null;
  images: string[];
  shop: { id: string; name: string; slug: string };
  variants: Variant[];
}

interface Avis {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  auteur: string;
}

interface ReponseAvis {
  moyenne: number;
  total: number;
  avis: Avis[];
}

/**
 * Étoiles en lecture seule (même rendu visuel que `Etoiles` dans
 * AvisProduit.tsx, non exporté de là-bas, donc recréé ici à l'identique
 * pour la page boutique — prompt du 15 oct. 2026, points 6 et 7).
 */
function Etoiles({ note, etoileLabel }: { note: number; etoileLabel: string }) {
  return (
    <span className={styles.etoiles}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-label={`${n} ${etoileLabel}`}
          style={{ color: n <= note ? "var(--color-or)" : "var(--color-border)" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function BoutiquePage() {
  const params = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { t } = useLocale();

  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [erreurBoutique, setErreurBoutique] = useState<string | null>(null);

  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargementProduits, setChargementProduits] = useState(true);

  const [avisDonnees, setAvisDonnees] = useState<ReponseAvis | null>(null);

  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Boutique>(`/marketplace/shops/${params.slug}`, false)
      .then(setBoutique)
      .catch((err) => setErreurBoutique(err instanceof Error ? err.message : t("boutique_introuvable")));
  }, [params.slug, t]);

  useEffect(() => {
    setChargementProduits(true);
    api
      .get<Produit[]>(`/marketplace/products?shopSlug=${params.slug}`, false)
      .then(setProduits)
      .catch(() => setProduits([]))
      .finally(() => setChargementProduits(false));
  }, [params.slug]);

  useEffect(() => {
    if (!boutique) return;
    api
      .get<ReponseAvis>(`/marketplace/shops/${boutique.id}/reviews`, false)
      .then(setAvisDonnees)
      .catch(() => setAvisDonnees({ moyenne: 0, total: 0, avis: [] }));
  }, [boutique]);

  async function envoyerMessage() {
    if (!boutique || !message.trim()) return;
    setEnvoiEnCours(true);
    setErreurEnvoi(null);
    try {
      await api.post(`/messagerie/conversations/boutique/${boutique.id}`, {
        message: message.trim(),
      });
      setMessage("");
      setEnvoye(true);
    } catch (err) {
      setErreurEnvoi(err instanceof ApiError ? err.message : t("boutique_envoiEchec"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (erreurBoutique) return <p style={{ padding: "48px" }}>{erreurBoutique}</p>;
  if (!boutique) return <p style={{ padding: "48px" }}>{t("commun_chargement")}</p>;

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <RetourLien href="/marketplace" label={t("produit_retourMarketplace")} />
        <h1 className={styles.titre}>
          ELEGANZ {t("nom_market")} — {boutique.name}
        </h1>

        <div className={styles.fiche}>
          {boutique.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boutique.logoUrl}
              alt={boutique.name}
              className={styles.logo}
              style={{ objectFit: "cover", width: "100%" }}
            />
          ) : (
            <div className={styles.logo}>{boutique.name}</div>
          )}

          <div>
            {boutique.noteMoyenne !== null && (
              <p className={styles.moyenne}>
                <Etoiles note={Math.round(boutique.noteMoyenne)} etoileLabel={t("avis_etoileLabel")} />{" "}
                {boutique.noteMoyenne}/5 ({boutique.nombreAvis} {t("avis_label")})
              </p>
            )}

            {boutique.deliveryZones.length > 0 && (
              <p className={styles.boutique}>
                {t("zonesLivraison_titre")} :{" "}
                {boutique.deliveryZones
                  .map((zone) => `${nomPays(t, zone.country)} — ${zone.city.name}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.titreSection}>{t("boutique_contacter")}</h2>
        {!user ? (
          <p className={styles.vide}>
            <Link href={`/marketplace/compte?retour=/marketplace/boutique/${boutique.slug}`} className={styles.lien}>
              {t("boutique_seConnecterPourContacter")}
            </Link>
          </p>
        ) : envoye ? (
          <div className={styles.confirmation}>
            {t("boutique_messageEnvoye")}{" "}
            <Link href="/marketplace/messagerie" className={styles.lien}>
              {t("boutique_voirMessagerie")}
            </Link>
          </div>
        ) : (
          <div className={styles.formulaire}>
            <textarea
              placeholder={t("boutique_placeholderMessage")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            {erreurEnvoi && <div className={styles.erreur}>{erreurEnvoi}</div>}
            <button
              className={styles.boutonEnvoyer}
              onClick={envoyerMessage}
              disabled={envoiEnCours || !message.trim()}
            >
              {envoiEnCours ? t("avis_envoiEnCours") : t("boutique_envoyer")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.titreSection}>{t("boutique_produits")}</h2>
        {chargementProduits ? (
          <p className={styles.vide}>{t("commun_chargement")}</p>
        ) : produits.length === 0 ? (
          <p className={styles.vide}>{t("boutique_aucunProduit")}</p>
        ) : (
          <div className={styles.grille}>
            {produits.map((produit) => {
              const disponibles = produit.variants.filter((v) => v.stockQty > 0);
              const moinsCher = disponibles.reduce<Variant | null>(
                (min, v) => (!min || Number(v.sellPrice) < Number(min.sellPrice) ? v : min),
                null,
              );
              return (
                <Link className={styles.carte} href={`/marketplace/produit/${produit.id}`} key={produit.id}>
                  <div style={{ position: "relative" }}>
                    {produit.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={produit.images[0]}
                        alt={produit.name}
                        className={styles.imageProduit}
                        style={{ objectFit: "cover", width: "100%" }}
                      />
                    ) : (
                      <div className={styles.imageProduit}>{produit.name}</div>
                    )}
                    {moinsCher && (
                      <RubanPromo sellPrice={Number(moinsCher.sellPrice)} compareAtPrice={moinsCher.compareAtPrice} />
                    )}
                  </div>
                  <div className={styles.nomProduit}>{produit.name}</div>
                  {moinsCher && (
                    <div className={styles.prix}>
                      <PrixPromo
                        sellPrice={Number(moinsCher.sellPrice)}
                        compareAtPrice={moinsCher.compareAtPrice}
                        currency={moinsCher.currency}
                        taille="petite"
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.titreSection}>{t("avis_titre")}</h2>
        {!avisDonnees ? (
          <p className={styles.vide}>{t("commun_chargement")}</p>
        ) : avisDonnees.total === 0 ? (
          <p className={styles.vide}>{t("avis_aucun")}</p>
        ) : (
          avisDonnees.avis.map((a) => (
            <div className={styles.avis} key={a.id}>
              <div className={styles.avisEntete}>
                <Etoiles note={a.rating} etoileLabel={t("avis_etoileLabel")} />
                <strong>{a.auteur}</strong>
                {a.verifiedPurchase && <span className={styles.badge}>{t("market_achatVerifie")}</span>}
              </div>
              {a.comment && <p className={styles.commentaire}>{a.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
