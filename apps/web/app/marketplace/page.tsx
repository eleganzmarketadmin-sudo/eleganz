"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatMoney } from "../lib/money";
import styles from "./page.module.css";

interface Variant {
  id: string;
  sellPrice: string;
  currency: string;
  stockQty: number;
}

interface Produit {
  id: string;
  name: string;
  category?: string | null;
  shop: { id: string; name: string; slug: string };
  variants: Variant[];
}

export default function MarketplacePage() {
  const [recherche, setRecherche] = useState("");
  const [requeteActive, setRequeteActive] = useState("");
  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    const params = requeteActive ? `?q=${encodeURIComponent(requeteActive)}` : "";
    api
      .get<Produit[]>(`/marketplace/products${params}`, false)
      .then((data) => {
        if (!annule) setProduits(data);
      })
      .catch((err) => {
        if (!annule) setErreur(err instanceof Error ? err.message : "Erreur.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [requeteActive]);

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <div className={styles.heroPhoto}>Photo de boutique à venir</div>
        <div className={styles.heroBloc}>
          <h1>Porter la couleur</h1>
          <p>Mode et luxe choisis chez des boutiques congolaises, livrés à Kinshasa.</p>
        </div>
      </div>

      <form
        className={styles.barreRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          setRequeteActive(recherche);
        }}
      >
        <input
          placeholder="Chercher une robe, une paire de sandales, une couleur…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </form>

      {chargement ? (
        <p className={styles.messageVide}>Chargement de la vitrine…</p>
      ) : erreur ? (
        <p className={styles.messageVide}>{erreur}</p>
      ) : produits.length === 0 ? (
        <p className={styles.messageVide}>Aucun article ne correspond à cette recherche.</p>
      ) : (
        <div className={styles.grille}>
          {produits.map((produit) => {
            const disponibles = produit.variants.filter((v) => v.stockQty > 0);
            const moinsCher = disponibles.reduce<Variant | null>(
              (min, v) => (!min || Number(v.sellPrice) < Number(min.sellPrice) ? v : min),
              null,
            );
            return (
              <div className={styles.carte} key={produit.id}>
                <div className={styles.imageProduit}>{produit.name}</div>
                <div className={styles.nomProduit}>{produit.name}</div>
                <div className={styles.boutique}>{produit.shop.name}</div>
                {moinsCher && (
                  <div className={styles.prix}>
                    {formatMoney(Number(moinsCher.sellPrice), moinsCher.currency)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
