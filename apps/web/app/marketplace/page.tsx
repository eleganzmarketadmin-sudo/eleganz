"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { Temoignages } from "./Temoignages";
import { BoutonBientotDisponible } from "../components/BoutonBientotDisponible";
import { PrixPromo } from "../components/PrixPromo";
import { useLocale } from "../lib/i18n/LocaleContext";
import { nomPays } from "../lib/i18n/nomPays";
import styles from "./page.module.css";

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

interface Pays {
  id: string;
  isoCode: string;
  name: string;
}

interface Ville {
  id: string;
  name: string;
}

interface Categorie {
  id: string;
  name: string;
}

export default function MarketplacePage() {
  const { t } = useLocale();
  const [recherche, setRecherche] = useState("");
  const [requeteActive, setRequeteActive] = useState("");
  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Filtre "livre chez moi" (prompt du 15 oct. 2026) — deux menus en
  // cascade, jamais de saisie libre, pour rester un filtre exact côté API.
  const [pays, setPays] = useState<Pays[]>([]);
  const [villesDuPaysChoisi, setVillesDuPaysChoisi] = useState<Ville[]>([]);
  const [paysChoisiId, setPaysChoisiId] = useState("");
  const [villeChoisieId, setVilleChoisieId] = useState("");

  // Filtres catégorie/prix (16 oct. 2026, demande client) — la catégorie
  // s'applique aussitôt choisie (liste fermée, référentiel global
  // ProductCategory) ; le prix exige "Appliquer" pour éviter une requête à
  // chaque frappe sur les deux champs.
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [prixMinSaisi, setPrixMinSaisi] = useState("");
  const [prixMaxSaisi, setPrixMaxSaisi] = useState("");
  const [prixMinActif, setPrixMinActif] = useState("");
  const [prixMaxActif, setPrixMaxActif] = useState("");

  useEffect(() => {
    api
      .get<Pays[]>("/geo/pays", false)
      .then(setPays)
      .catch(() => {
        // Non bloquant : sans liste de pays, le filtre par ville reste simplement caché.
      });
    api
      .get<Categorie[]>("/categories", false)
      .then(setCategories)
      .catch(() => {
        // Non bloquant : sans liste, le filtre catégorie reste simplement caché.
      });
  }, []);

  useEffect(() => {
    if (!paysChoisiId) {
      setVillesDuPaysChoisi([]);
      return;
    }
    let annule = false;
    api
      .get<Ville[]>(`/geo/pays/${paysChoisiId}/villes`, false)
      .then((villes) => {
        if (!annule) {
          setVillesDuPaysChoisi(villes);
          setVilleChoisieId("");
        }
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [paysChoisiId]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    const parametres = new URLSearchParams();
    if (requeteActive) parametres.set("q", requeteActive);
    if (villeChoisieId) parametres.set("cityId", villeChoisieId);
    if (categorieChoisie) parametres.set("category", categorieChoisie);
    if (prixMinActif) parametres.set("minPrice", prixMinActif);
    if (prixMaxActif) parametres.set("maxPrice", prixMaxActif);
    const chaine = parametres.toString();
    api
      .get<Produit[]>(`/marketplace/products${chaine ? `?${chaine}` : ""}`, false)
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
  }, [requeteActive, villeChoisieId, categorieChoisie, prixMinActif, prixMaxActif]);

  const filtresPrixModifies = prixMinSaisi !== prixMinActif || prixMaxSaisi !== prixMaxActif;
  const filtresActifs = Boolean(categorieChoisie || prixMinActif || prixMaxActif);

  function reinitialiserFiltres() {
    setCategorieChoisie("");
    setPrixMinSaisi("");
    setPrixMaxSaisi("");
    setPrixMinActif("");
    setPrixMaxActif("");
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <h1>ELEGANZ {t("nom_market")}</h1>
        <p>{t("market_sousTitre")}</p>
      </div>

      <form
        className={styles.barreRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          setRequeteActive(recherche);
        }}
      >
        <input
          placeholder={t("market_rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <BoutonBientotDisponible icone="📷" label={t("market_rechercherParPhoto")} />
        <select
          aria-label={t("zonesLivraison_pays")}
          value={paysChoisiId}
          onChange={(e) => setPaysChoisiId(e.target.value)}
        >
          <option value="">{t("zonesLivraison_choisirPays")}</option>
          {pays.map((p) => (
            <option key={p.id} value={p.id}>
              {nomPays(t, p)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("zonesLivraison_ville")}
          value={villeChoisieId}
          onChange={(e) => setVilleChoisieId(e.target.value)}
          disabled={!paysChoisiId}
        >
          <option value="">{t("zonesLivraison_choisirVille")}</option>
          {villesDuPaysChoisi.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </form>

      <div className={styles.barreFiltres}>
        <select
          aria-label={t("market_filtreCategorie")}
          value={categorieChoisie}
          onChange={(e) => setCategorieChoisie(e.target.value)}
        >
          <option value="">{t("market_toutesCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          inputMode="decimal"
          aria-label={t("market_prixMin")}
          placeholder={t("market_prixMin")}
          value={prixMinSaisi}
          onChange={(e) => setPrixMinSaisi(e.target.value)}
        />
        <input
          type="number"
          min={0}
          inputMode="decimal"
          aria-label={t("market_prixMax")}
          placeholder={t("market_prixMax")}
          value={prixMaxSaisi}
          onChange={(e) => setPrixMaxSaisi(e.target.value)}
        />
        <button
          type="button"
          className={styles.boutonFiltre}
          disabled={!filtresPrixModifies}
          onClick={() => {
            setPrixMinActif(prixMinSaisi);
            setPrixMaxActif(prixMaxSaisi);
          }}
        >
          {t("market_appliquerPrix")}
        </button>
        {filtresActifs && (
          <button type="button" className={styles.boutonFiltreTexte} onClick={reinitialiserFiltres}>
            {t("market_reinitialiserFiltres")}
          </button>
        )}
      </div>

      {chargement ? (
        <p className={styles.messageVide}>{t("market_chargement")}</p>
      ) : erreur ? (
        <p className={styles.messageVide}>{erreur}</p>
      ) : produits.length === 0 ? (
        <p className={styles.messageVide}>{t("market_aucunArticle")}</p>
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
                <div className={styles.nomProduit}>{produit.name}</div>
                <div className={styles.boutique}>{produit.shop.name}</div>
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

      <Temoignages />
    </div>
  );
}
