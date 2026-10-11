"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { formatMoney } from "../../../lib/money";
import { useCart } from "../../../lib/cart-context";
import styles from "./page.module.css";

interface Variant {
  id: string;
  size?: string | null;
  color?: string | null;
  sellPrice: string;
  currency: string;
  stockQty: number;
}

interface Produit {
  id: string;
  name: string;
  description?: string | null;
  images: string[];
  shop: { id: string; name: string; slug: string };
  variants: Variant[];
}

export default function ProduitPage() {
  const params = useParams<{ id: string }>();
  const { ajouter } = useCart();
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
      .catch((err) => setErreur(err instanceof Error ? err.message : "Produit introuvable."));
  }, [params.id]);

  if (erreur) return <p style={{ padding: "48px" }}>{erreur}</p>;
  if (!produit) return <p style={{ padding: "48px" }}>Chargement…</p>;

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
      {produit.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={produit.images[0]} alt={produit.name} className={styles.image} style={{ objectFit: "cover", width: "100%" }} />
      ) : (
        <div className={styles.image}>{produit.name}</div>
      )}
      <div>
        <h1 className={styles.titre}>{produit.name}</h1>
        <p className={styles.boutique}>Vendu par {produit.shop.name}</p>
        {produit.description && <p style={{ marginBottom: "24px" }}>{produit.description}</p>}

        {variante && <div className={styles.prix}>{formatMoney(Number(variante.sellPrice), variante.currency)}</div>}

        {produit.variants.length > 1 && (
          <div className={styles.variantes}>
            {produit.variants.map((v) => (
              <button
                key={v.id}
                disabled={v.stockQty <= 0}
                className={`${styles.varianteBouton} ${varianteId === v.id ? styles.varianteBoutonActif : ""}`}
                onClick={() => setVarianteId(v.id)}
              >
                {[v.size, v.color].filter(Boolean).join(" · ") || "Unique"}
              </button>
            ))}
          </div>
        )}

        <button className={styles.bouton} onClick={ajouterAuPanier} disabled={!variante || variante.stockQty <= 0}>
          {variante && variante.stockQty > 0 ? "Ajouter au panier" : "Épuisé"}
        </button>

        {confirmation && <div className={styles.confirmation}>Ajouté au panier.</div>}
      </div>
    </div>
  );
}
