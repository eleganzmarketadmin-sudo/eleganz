"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { Temoignages } from "./Temoignages";
import { BoutonBientotDisponible } from "../components/BoutonBientotDisponible";
import { PrixPromo, RubanPromo, RubanNouveau } from "../components/PrixPromo";
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
  isNewArrival: boolean;
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

/**
 * Motif géométrique original façon tissu wax (25 nov. 2026, héros éditorial
 * Marketplace) — losanges décalés en aplats de couleur pleine, jamais de
 * dégradé ni d'ombre (voir docs/DESIGN_SYSTEM.md, principe n°2). Sert de
 * repli quand aucune photo produit n'est encore disponible pour illustrer le
 * héros (catalogue vide ou pas encore chargé) : uniquement les teintes déjà
 * attribuées à ce module (Magenta Sape) + Encre + une touche d'Or, jamais une
 * couleur empruntée à un autre module.
 */
function MotifWax() {
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true">
      <rect width="120" height="120" fill="var(--color-magenta)" />
      <pattern id="wax-losanges" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="var(--color-magenta)" />
        <polygon points="20,2 38,20 20,38 2,20" fill="var(--color-encre-fixe)" opacity="0.18" />
        <polygon points="0,0 8,0 0,8" fill="var(--color-or)" opacity="0.5" />
        <polygon points="40,40 32,40 40,32" fill="var(--color-or)" opacity="0.5" />
      </pattern>
      <rect width="120" height="120" fill="url(#wax-losanges)" />
    </svg>
  );
}

/**
 * Enveloppe `useSearchParams` dans un Suspense (convention recommandée du
 * App Router) — nécessaire pour lire `?q=` / `?category=` (11 nov. 2026,
 * amélioration "expérience grand public" : la barre de recherche de
 * l'accueil et le sitemap par catégorie renvoient maintenant vers une
 * Marketplace qui respecte réellement ces paramètres au chargement, plutôt
 * que vers une recherche vide qu'il fallait relancer à la main).
 */
export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceContenu />
    </Suspense>
  );
}

function MarketplaceContenu() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recherche, setRecherche] = useState(() => searchParams.get("q") ?? "");
  const [requeteActive, setRequeteActive] = useState(() => searchParams.get("q") ?? "");
  // Recherche de boutiques (demande du 12 nov. 2026 : "prévoir également un
  // champ de recherche pour les boutiques") — la recherche par nom de
  // boutique existe déjà et fonctionne sur /marketplace/boutiques, mais
  // n'était accessible qu'en s'y rendant d'abord sans pouvoir chercher
  // directement. Ce champ redirige vers cette page avec la requête déjà
  // appliquée (voir ?q= géré là-bas, même mécanisme que pour les produits).
  const [rechercheBoutique, setRechercheBoutique] = useState("");
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
  const [categorieChoisie, setCategorieChoisie] = useState(() => searchParams.get("category") ?? "");
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

  // Héros éditorial (25 nov. 2026, retour propriétaire — "quelles variations
  // de couleurs dégradées granulées... bref pas une programmation robotique,
  // inspirez-vous d'autres plateformes" ; référence citée :
  // fcbarcelona.fr/fr) — remplace l'ancien bandeau plat (titre + phrase,
  // aplat magenta uni) par le héros en deux blocs inégaux déjà PRÉVU dans
  // docs/DESIGN_SYSTEM.md ("Marketplace — bloc de couleur éditorial") mais
  // jamais construit : photo pleine hauteur + aplat Magenta Sape, dans
  // l'esprit d'une veste et d'un pantalon de couleurs contrastées. Aucun
  // dégradé nulle part dans ce bloc (principe du système : "la hiérarchie
  // vient des aplats de couleur, pas des ombres") — le titre reste toujours
  // entièrement posé sur l'aplat de couleur, jamais sur la photo, donc même
  // un dégradé de lisibilité n'est pas nécessaire ici.
  //
  // 25 nov. 2026, retour propriétaire : "affiche une photo... sans être un
  // menu défilant des différents produits" — une seule photo statique ne
  // rendait pas compte de la diversité du catalogue. Remplacée par un
  // défilement continu (bande façon pellicule) de plusieurs vrais produits
  // du catalogue (contenu authentique déjà hébergé par la plateforme,
  // jamais une image d'archive téléchargée depuis l'extérieur), chacun
  // cliquable vers sa fiche. Dupliqué une fois pour boucler sans coupure
  // (voir l'animation dans page.module.css) ; mis en pause au survol pour
  // laisser le temps de regarder/cliquer, et à l'arrêt si la personne a
  // demandé de réduire les animations (prefers-reduced-motion). Tant que le
  // catalogue n'a encore rien chargé (ou si aucun article n'a de photo), on
  // affiche à la place un motif géométrique original façon tissu wax (voir
  // MotifWax plus bas) : jamais de case vide, jamais une image cassée.
  const produitsIllustres = produits.filter((p) => p.images[0]).slice(0, 10);

  return (
    <div className={styles.cadre}>
      <div className={styles.heros}>
        <div className={styles.herosPhoto}>
          {produitsIllustres.length > 0 ? (
            <div className={styles.herosDefilement}>
              {[...produitsIllustres, ...produitsIllustres].map((p, i) => (
                <Link
                  key={`${p.id}-${i}`}
                  href={`/marketplace/produit/${p.id}`}
                  className={styles.herosVignette}
                  aria-hidden={i >= produitsIllustres.length ? "true" : undefined}
                  tabIndex={i >= produitsIllustres.length ? -1 : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.images[0]} alt={p.name} />
                </Link>
              ))}
            </div>
          ) : (
            <MotifWax />
          )}
        </div>
        <div className={styles.herosBloc}>
          <h1 className={styles.herosTitre}>{t("market_herosTitre")}</h1>
          <p className={styles.herosSousTitre}>{t("market_sousTitre")}</p>
          <Link href="/marketplace/boutiques" className={styles.herosCta}>
            {t("market_herosCta")}
          </Link>
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
          placeholder={t("market_rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <button type="submit" className={styles.boutonRecherche}>
          {t("accueil_rechercheProduitBouton")}
        </button>
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

      <form
        className={styles.barreRechercheBoutiques}
        onSubmit={(e) => {
          e.preventDefault();
          const q = rechercheBoutique.trim();
          router.push(q ? `/marketplace/boutiques?q=${encodeURIComponent(q)}` : "/marketplace/boutiques");
        }}
      >
        <label htmlFor="rechercheBoutique">{t("market_boutiques")}</label>
        <input
          id="rechercheBoutique"
          placeholder={t("boutiques_rechercherPlaceholder")}
          value={rechercheBoutique}
          onChange={(e) => setRechercheBoutique(e.target.value)}
        />
        <button type="submit" className={styles.boutonRecherche}>
          {t("accueil_rechercheProduitBouton")}
        </button>
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
                  <RubanNouveau isNewArrival={produit.isNewArrival} />
                </div>
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
