"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useCart } from "../../../lib/cart-context";
import { AvisProduit } from "./AvisProduit";
import { RetourLien } from "../../../components/RetourLien";
import { PrixPromo, RubanPromo, RubanNouveau } from "../../../components/PrixPromo";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import { nomPays } from "../../../lib/i18n/nomPays";
import { formatMoney } from "../../../lib/money";
import { prixUnitaireEffectif } from "../../../lib/price-tiers";
import styles from "./page.module.css";

interface PaletteDePrix {
  minQuantity: number;
  unitPrice: string;
}

interface Variant {
  id: string;
  size?: string | null;
  color?: string | null;
  sellPrice: string;
  compareAtPrice?: string | null;
  currency: string;
  stockQty: number;
  priceTiers: PaletteDePrix[];
}

interface ZoneLivraison {
  id: string;
  country: { isoCode: string; name: string };
  city: { name: string };
}

interface Produit {
  id: string;
  name: string;
  description?: string | null;
  images: string[];
  isNewArrival: boolean;
  shop: { id: string; name: string; slug: string; deliveryZones?: ZoneLivraison[] };
  variants: Variant[];
}

/**
 * Reçoit `id` en prop plutôt que de lire `useParams()` lui-même : ce
 * composant est désormais rendu par `page.tsx` (Composant Serveur), qui a
 * besoin de connaître l'identifiant produit AVANT le rendu client pour
 * générer les métadonnées de partage (voir generateMetadata dans ce même
 * dossier) — un seul identifiant lu une seule fois, à un seul endroit.
 */
export default function ProduitClient({ id }: { id: string }) {
  const { ajouter } = useCart();
  const { t } = useLocale();
  const [produit, setProduit] = useState<Produit | null>(null);
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  // Partage (11 nov. 2026, amélioration "expérience grand public") — bascule
  // brièvement sur un message de confirmation après copie du lien, pour les
  // navigateurs sans Web Share API (essentiellement les ordinateurs de
  // bureau ; sur mobile, navigator.share ouvre directement WhatsApp etc.).
  const [lienCopie, setLienCopie] = useState(false);
  // Quantité choisie avant mise au panier (2 nov. 2026, prix de gros) —
  // auparavant toujours 1 à l'ajout ; une boutique avec des paliers "à
  // partir de X pièces" doit pouvoir être atteinte dès la fiche produit, pas
  // seulement en modifiant la quantité après coup dans le panier.
  const [quantite, setQuantite] = useState(1);

  useEffect(() => {
    api
      .get<Produit>(`/marketplace/products/${id}`, false)
      .then((data) => {
        setProduit(data);
        const premiereDisponible = data.variants.find((v) => v.stockQty > 0);
        setVarianteId(premiereDisponible?.id ?? null);
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : t("produit_introuvable")));
  }, [id, t]);

  if (erreur) return <p style={{ padding: "48px" }}>{erreur}</p>;
  if (!produit) return <p style={{ padding: "48px" }}>{t("produit_chargement")}</p>;

  const variante = produit.variants.find((v) => v.id === varianteId);
  const paliersNumeriques = variante?.priceTiers.map((p) => ({ minQuantity: p.minQuantity, unitPrice: Number(p.unitPrice) })) ?? [];
  const prixUnitaireActuel = variante
    ? prixUnitaireEffectif(quantite, Number(variante.sellPrice), paliersNumeriques)
    : 0;

  function ajouterAuPanier() {
    if (!produit || !variante) return;
    ajouter(
      {
        variantId: variante.id,
        productName: produit.name,
        shopName: produit.shop.name,
        size: variante.size,
        color: variante.color,
        basePrice: Number(variante.sellPrice),
        priceTiers: paliersNumeriques,
        unitPrice: prixUnitaireActuel,
        currency: variante.currency,
        stockDisponible: variante.stockQty,
      },
      quantite,
    );
    setConfirmation(true);
  }

  async function partager() {
    if (!produit) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const titre = `ELEGANZ — ${produit.name}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titre, text: titre, url });
      } catch {
        // L'utilisateur a annulé le partage — rien à faire, pas une erreur.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 2500);
    } catch {
      // Navigateur sans Web Share ni Clipboard API : rien d'autre à proposer.
    }
  }

  return (
    <div className={styles.cadre}>
      <div style={{ gridColumn: "1 / -1" }}>
        <RetourLien href="/marketplace" label={t("produit_retourMarketplace")} />
      </div>
      <div style={{ position: "relative" }}>
        {produit.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produit.images[0]} alt={produit.name} className={styles.image} style={{ objectFit: "cover", width: "100%" }} />
        ) : (
          <div className={styles.image}>{produit.name}</div>
        )}
        {variante && <RubanPromo sellPrice={Number(variante.sellPrice)} compareAtPrice={variante.compareAtPrice} />}
        <RubanNouveau isNewArrival={produit.isNewArrival} />
      </div>
      <div>
        <h1 className={styles.titre}>{produit.name}</h1>
        <p className={styles.boutique}>{t("produit_venduPar")} {produit.shop.name}</p>
        {produit.shop.deliveryZones && produit.shop.deliveryZones.length > 0 && (
          <p className={styles.boutique} style={{ marginBottom: "16px" }}>
            {t("zonesLivraison_titre")} : {" "}
            {produit.shop.deliveryZones
              .map((zone) => `${nomPays(t, zone.country)} — ${zone.city.name}`)
              .join(" · ")}
          </p>
        )}
        {produit.description && <p style={{ marginBottom: "24px" }}>{produit.description}</p>}

        {variante && (
          <div className={styles.prix}>
            <PrixPromo
              sellPrice={prixUnitaireActuel}
              compareAtPrice={quantite === 1 ? variante.compareAtPrice : null}
              currency={variante.currency}
            />
          </div>
        )}

        {variante && variante.priceTiers.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", fontSize: "0.875rem", color: "var(--color-texte-muted)" }}>
            <li style={{ fontWeight: 600, color: "inherit", marginBottom: "4px" }}>{t("market_prixDeGrosTitre")}</li>
            {variante.priceTiers.map((palier) => (
              <li key={palier.minQuantity}>
                {t("cat_aPartirDe")} {palier.minQuantity} {t("cat_pieces")} : {formatMoney(Number(palier.unitPrice), variante.currency)} {t("cat_parUnite")}
              </li>
            ))}
          </ul>
        )}

        {produit.variants.length > 1 && (
          <div className={styles.variantes}>
            {produit.variants.map((v) => (
              <button
                key={v.id}
                disabled={v.stockQty <= 0}
                className={`${styles.varianteBouton} ${varianteId === v.id ? styles.varianteBoutonActif : ""}`}
                onClick={() => {
                  setVarianteId(v.id);
                  setQuantite(1);
                }}
              >
                {[v.size, v.color].filter(Boolean).join(" · ") || t("produit_unique")}
              </button>
            ))}
          </div>
        )}

        {variante && variante.stockQty > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <label htmlFor="quantite" style={{ fontSize: "0.875rem" }}>
              {t("produit_quantite")}
            </label>
            <input
              id="quantite"
              type="number"
              min={1}
              max={variante.stockQty}
              value={quantite}
              onChange={(e) => setQuantite(Math.max(1, Math.min(Number(e.target.value) || 1, variante.stockQty)))}
              style={{ width: "80px", padding: "8px" }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--espace-3)", flexWrap: "wrap" }}>
          <button className={styles.bouton} onClick={ajouterAuPanier} disabled={!variante || variante.stockQty <= 0}>
            {variante && variante.stockQty > 0 ? t("produit_ajouterPanier") : t("produit_epuise")}
          </button>
          <button className={styles.boutonPartager} onClick={partager} type="button">
            {lienCopie ? t("produit_lienCopie") : t("produit_partager")}
          </button>
        </div>

        {confirmation && <div className={styles.confirmation}>{t("produit_ajoutePanier")}</div>}
      </div>

      <AvisProduit shopId={produit.shop.id} productId={produit.id} />
    </div>
  );
}
