"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { useCart } from "../../../lib/cart-context";
import { AvisProduit } from "./AvisProduit";
import { RetourLien } from "../../../components/RetourLien";
import { PrixPromo, RubanPromo } from "../../../components/PrixPromo";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import { nomPays } from "../../../lib/i18n/nomPays";
import styles from "./page.module.css";

interface Variant {
  id: string;
  size?: string | null;
  color?: string | null;
  sellPrice: string;
  compareAtPrice?: string | null;
  currency: string;
  stockQty: number;
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
  shop: { id: string; name: string; slug: string; deliveryZones?: ZoneLivraison[] };
  variants: Variant[];
}

export default function ProduitPage() {
  const params = useParams<{ id: string }>();
  const { ajouter } = useCart();
  const { t } = useLocale();
  const [produit, setProduit] = useState<Produit | null>(null);
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    api
      .get<Produit>(`/marketplace/products/${params.id}`, false)
      .then((data) => {
        setProduit(data);
        const premiereDisponible = data.variants.find((v) => v.stockQty > 0);
        setVarianteId(premiereDisponible?.id ?? null);
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : t("produit_introuvable")));
  }, [params.id, t]);

  if (erreur) return <p style={{ padding: "48px" }}>{erreur}</p>;
  if (!produit) return <p style={{ padding: "48px" }}>{t("produit_chargement")}</p>;

  const variante = produit.variants.find((v) => v.id === varianteId);

  function ajouterAuPanier() {
    if (!produit || !variante) return;
    ajouter(
      {
        variantId: variante.id,
        productName: produit.name,
        shopName: produit.shop.name,
        size: variante.size,
        color: variante.color,
        unitPrice: Number(variante.sellPrice),
        currency: variante.currency,
        stockDisponible: variante.stockQty,
      },
      1,
    );
    setConfirmation(true);
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
              sellPrice={Number(variante.sellPrice)}
              compareAtPrice={variante.compareAtPrice}
              currency={variante.currency}
            />
          </div>
        )}

        {produit.variants.length > 1 && (
          <div className={styles.variantes}>
            {produit.variants.map((v) => (
              <button
                key={v.id}
                disabled={v.stockQty <= 0}
                className={`${styles.varianteBouton} ${varianteId === v.id ? styles.varianteBoutonActif : ""}`}
                onClick={() => setVarianteId(v.id)}
              >
                {[v.size, v.color].filter(Boolean).join(" · ") || t("produit_unique")}
              </button>
            ))}
          </div>
        )}

        <button className={styles.bouton} onClick={ajouterAuPanier} disabled={!variante || variante.stockQty <= 0}>
          {variante && variante.stockQty > 0 ? t("produit_ajouterPanier") : t("produit_epuise")}
        </button>

        {confirmation && <div className={styles.confirmation}>{t("produit_ajoutePanier")}</div>}
      </div>

      <AvisProduit shopId={produit.shop.id} productId={produit.id} />
    </div>
  );
}
