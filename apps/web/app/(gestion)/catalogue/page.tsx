"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { BoutonBientotDisponible } from "../../components/BoutonBientotDisponible";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney, pourcentageRemise } from "../../lib/money";
import { telechargerFichier, envoyerFichier } from "../../lib/telecharger-fichier";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface LigneResultatImport {
  ligne: number;
  statut: "créé" | "mis à jour" | "erreur";
  message?: string;
  sku?: string;
}

interface ResultatImport {
  resultats: LigneResultatImport[];
  creees: number;
  misesAJour: number;
  erreurs: number;
}

/**
 * Import/export Excel en masse (prompt du 12 oct. 2026) — volontairement
 * placé tout en haut de la page, avant la recherche d'articles, puisque
 * c'est la première chose qu'une boutique qui a déjà un catalogue ailleurs
 * voudra faire en arrivant sur cet écran.
 */
function ImportExportExcel({ onImporte }: { onImporte: () => void }) {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState<"gabarit" | "export" | "import" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);

  async function telechargerGabarit() {
    setErreur(null);
    setEnCours("gabarit");
    try {
      await telechargerFichier(
        `/shops/${currentShop!.id}/products/import-template`,
        "gabarit-articles-eleganz.xlsx",
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("cat_telechargementImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function exporterCatalogue() {
    setErreur(null);
    setEnCours("export");
    try {
      await telechargerFichier(`/shops/${currentShop!.id}/products/export`, "articles-eleganz.xlsx");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("fact_exportImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function importerFichier(fichier: File) {
    setErreur(null);
    setResultat(null);
    setEnCours("import");
    try {
      const resultat = await envoyerFichier<ResultatImport>(
        `/shops/${currentShop!.id}/products/import`,
        fichier,
      );
      setResultat(resultat);
      if (resultat.creees > 0 || resultat.misesAJour > 0) onImporte();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("cat_importImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className={styles.blocImport}>
      <h2 className={styles.sousTitre}>{t("cat_importExportTitre")}</h2>
      <p className={styles.texteAide}>{t("cat_importExportAide")}</p>
      <div className={styles.actionsImport}>
        <button className={styles.boutonSecondaire} onClick={telechargerGabarit} disabled={enCours !== null}>
          {enCours === "gabarit" ? "…" : t("cat_telechargerGabarit")}
        </button>
        <button className={styles.boutonSecondaire} onClick={exporterCatalogue} disabled={enCours !== null}>
          {enCours === "export" ? "…" : t("cat_exporterCatalogue")}
        </button>
        <label
          className={styles.bouton}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", minHeight: "40px" }}
        >
          {enCours === "import" ? t("cat_importEnCours") : t("cat_importerFichier")}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            disabled={enCours !== null}
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              e.target.value = "";
              if (fichier) importerFichier(fichier);
            }}
          />
        </label>
      </div>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {resultat && (
        <div className={styles.resultatImport}>
          <p>
            <strong>{resultat.creees}</strong> {t("cat_resultatCrees")}, <strong>{resultat.misesAJour}</strong>{" "}
            {t("cat_resultatMisAJour")}, <strong>{resultat.erreurs}</strong> {t("cat_resultatErreurs")}{" "}
            {resultat.resultats.length} {t("cat_resultatLignes")}
          </p>
          {resultat.erreurs > 0 && (
            <ul className={styles.listeErreursImport}>
              {resultat.resultats
                .filter((r) => r.statut === "erreur")
                .map((r, i) => (
                  <li key={i}>
                    {t("cat_ligne")} {r.ligne}{r.sku ? ` (${r.sku})` : ""} : {r.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface Variant {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  costPrice?: string | null;
  sellPrice: string;
  compareAtPrice?: string | null;
  currency: string;
  stockQty: number;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isPublished: boolean;
  images: string[];
  variants: Variant[];
}

function ImagesProduit({
  produit,
  onChange,
}: {
  produit: Product;
  onChange: () => void;
}) {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function sauvegarder(images: string[]) {
    if (!currentShop) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produit.id}`, { images });
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_imageRefusee"));
    } finally {
      setEnCours(false);
    }
  }

  async function ajouterImage() {
    if (!url) return;
    await sauvegarder([...produit.images, url]);
    setUrl("");
  }

  async function televerserPhoto(fichier: File) {
    if (!currentShop) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/shops/${currentShop.id}/products/${produit.id}/images/upload-url`,
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!envoi.ok) {
        throw new Error(t("cat_erreurEnvoiStockage"));
      }
      await sauvegarder([...produit.images, publicUrl]);
    } catch (err) {
      // `fetch` vers le stockage objet (étape 2, hors domaine ELEGANZ) lève
      // un simple `TypeError: Failed to fetch` dès que la requête n'atteint
      // jamais le serveur — CORS du bucket non configuré pour ce site,
      // réseau coupé, ou URL signée expirée (16 oct. 2026, diagnostic
      // "failed to fetch" systématique) — un message générique ne dirait
      // rien d'actionnable, on distingue donc ce cas précis.
      if (err instanceof TypeError) {
        setErreur(t("cat_erreurEnvoiPhotoReseau"));
      } else {
        setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("cat_erreurEnvoiPhoto"));
      }
    } finally {
      setEnCours(false);
    }
  }

  async function retirerImage(index: number) {
    await sauvegarder(produit.images.filter((_, i) => i !== index));
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
      {produit.images.map((img, i) => (
        <div key={i} style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={produit.name}
            style={{ width: "64px", height: "80px", objectFit: "cover", border: "1px solid var(--color-border)" }}
          />
          <button
            onClick={() => retirerImage(i)}
            aria-label={t("cat_retirerImage")}
            style={{
              position: "absolute",
              top: "-8px",
              right: "-8px",
              background: "var(--color-flamme)",
              color: "#fff",
              border: "none",
              width: "20px",
              height: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      ))}
      <label className={styles.bouton} style={{ minHeight: "40px", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
        {t("cat_televerserPhoto")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            e.target.value = "";
            if (fichier) televerserPhoto(fichier);
          }}
          disabled={enCours}
          style={{ display: "none" }}
        />
      </label>
      <details style={{ fontSize: "0.8125rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--color-cobalt)" }}>{t("cat_collerUrl")}</summary>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <input
            placeholder={t("cat_placeholderUrlPhoto")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ minWidth: "260px", padding: "8px", border: "1px solid var(--color-border)" }}
          />
          <button className={styles.bouton} style={{ minHeight: "40px" }} onClick={ajouterImage} disabled={enCours || !url}>
            {t("cat_ajouter")}
          </button>
        </div>
      </details>
      {erreur && <span style={{ color: "var(--color-flamme)", fontSize: "0.8125rem" }}>{erreur}</span>}
    </div>
  );
}

interface VariantOptionsListe {
  sizes: string[];
  colors: string[];
}

/**
 * Sélecteur à choix multiple pour une liste déroulante taille/couleur de la
 * boutique (demande du 12 oct. 2026) — remplace la saisie libre. Un petit
 * champ "+ ajouter" permet d'enrichir la liste de la boutique sans quitter
 * l'écran ; la nouvelle valeur est aussitôt sélectionnée.
 */
function SelecteurMultiple({
  label,
  valeurs,
  selection,
  onChangeSelection,
  onAjouterValeur,
}: {
  label: string;
  valeurs: string[];
  selection: string[];
  onChangeSelection: (v: string[]) => void;
  onAjouterValeur: (valeur: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [nouvelleValeur, setNouvelleValeur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function ajouter() {
    const v = nouvelleValeur.trim();
    if (!v) return;
    setEnCours(true);
    try {
      await onAjouterValeur(v);
      setNouvelleValeur("");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.champ}>
      <label>{label}</label>
      <select
        multiple
        value={selection}
        onChange={(e) => onChangeSelection(Array.from(e.target.selectedOptions, (o) => o.value))}
        style={{ minHeight: "84px" }}
      >
        {valeurs.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
        <input
          placeholder={t("cat_nouvelleValeur")}
          value={nouvelleValeur}
          onChange={(e) => setNouvelleValeur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          style={{ flex: 1, padding: "6px", fontSize: "0.8125rem" }}
        />
        <button
          type="button"
          className={styles.boutonSecondaire}
          style={{ padding: "4px 10px", minHeight: "32px" }}
          onClick={ajouter}
          disabled={enCours || !nouvelleValeur.trim()}
        >
          {t("cat_ajouter")}
        </button>
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>{t("cat_aideSelecteurMultiple")}</span>
    </div>
  );
}

interface CategorieProduit {
  id: string;
  name: string;
}

/**
 * Combobox filtrable pour la catégorie (16 oct. 2026, demande client :
 * remplacer la saisie libre par une liste déroulante qui filtre selon la
 * saisie, pour que le filtre catégorie du Marketplace reste exploitable).
 * Référentiel GLOBAL (voir ProductCategory), pas propre à la boutique —
 * contrairement à `SelecteurMultiple` (tailles/couleurs). Taper filtre la
 * liste ; une valeur inédite propose de l'ajouter au référentiel partagé,
 * comme pour les tailles/couleurs.
 */
function SelecteurCategorie({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<CategorieProduit[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<CategorieProduit[]>("/categories", false)
      .then(setCategories)
      .catch(() => {
        // Non bloquant : la liste reste vide, le champ se comporte alors
        // comme une saisie libre classique (pas de blocage de la création).
      });
  }, []);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const requete = valeur.trim().toLowerCase();
  const correspondances = requete ? categories.filter((c) => c.name.toLowerCase().includes(requete)) : categories;
  const correspondanceExacte = categories.some((c) => c.name.toLowerCase() === requete);

  async function ajouterCategorie() {
    const nom = valeur.trim();
    if (!nom) return;
    setEnCours(true);
    try {
      const liste = await api.post<CategorieProduit[]>("/categories", { name: nom });
      setCategories(liste);
      onChange(nom);
      setOuvert(false);
    } catch {
      // Non bloquant : l'article garde cette valeur en texte simple même si
      // l'ajout au référentiel partagé échoue (ex. hors ligne).
      setOuvert(false);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div ref={conteneurRef} style={{ position: "relative" }}>
      <input
        id="categorie"
        placeholder={t("cat_placeholderCategorie")}
        value={valeur}
        autoComplete="off"
        onFocus={() => setOuvert(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOuvert(true);
        }}
      />
      {ouvert && (categories.length > 0 || requete) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {correspondances.map((c) => (
            <div
              key={c.id}
              style={{ padding: "8px 10px", cursor: "pointer" }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.name);
                setOuvert(false);
              }}
            >
              {c.name}
            </div>
          ))}
          {correspondances.length === 0 && !requete && (
            <div style={{ padding: "8px 10px", color: "var(--color-texte-muted)" }}>
              {t("cat_aucuneCategorieListe")}
            </div>
          )}
          {requete && !correspondanceExacte && (
            <div
              style={{
                padding: "8px 10px",
                cursor: enCours ? "default" : "pointer",
                color: "var(--color-cobalt)",
                borderTop: correspondances.length > 0 ? "1px solid var(--color-border)" : "none",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!enCours) ajouterCategorie();
              }}
            >
              {enCours ? "…" : `${t("cat_ajouterCategorie")} « ${valeur.trim()} »`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NouvelleVariante({ produitId, onAjoutee }: { produitId: string; onAjoutee: () => void }) {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [options, setOptions] = useState<VariantOptionsListe>({ sizes: [], colors: [] });
  const [sku, setSku] = useState("");
  const [taillesChoisies, setTaillesChoisies] = useState<string[]>([]);
  const [couleursChoisies, setCouleursChoisies] = useState<string[]>([]);
  const [prixAchat, setPrixAchat] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [stock, setStock] = useState("0");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<VariantOptionsListe>(`/shops/${currentShop.id}/variant-options`)
      .then(setOptions)
      .catch(() => {
        // Non bloquant : les listes restent simplement vides, on peut encore
        // ajouter des valeurs à la volée.
      });
  }, [currentShop]);

  async function ajouterOption(kind: "SIZE" | "COLOR", valeur: string) {
    if (!currentShop) return;
    const resultat = await api.post<VariantOptionsListe>(`/shops/${currentShop.id}/variant-options`, {
      kind,
      value: valeur,
    });
    setOptions(resultat);
    if (kind === "SIZE") setTaillesChoisies((prev) => [...new Set([...prev, valeur])]);
    else setCouleursChoisies((prev) => [...new Set([...prev, valeur])]);
  }

  const nombreVariantes = Math.max(taillesChoisies.length, 1) * Math.max(couleursChoisies.length, 1);

  async function ajouter() {
    if (!currentShop || !sku || !prixVente) return;
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      const variantes = await api.post<unknown[]>(
        `/shops/${currentShop.id}/products/${produitId}/variants/bulk`,
        {
          skuBase: sku,
          sizes: taillesChoisies.length ? taillesChoisies : undefined,
          colors: couleursChoisies.length ? couleursChoisies : undefined,
          costPrice: prixAchat ? Number(prixAchat) : undefined,
          sellPrice: Number(prixVente),
          initialStockQty: stock ? Number(stock) : 0,
        },
      );
      setConfirmation(
        variantes.length > 1
          ? `${variantes.length} ${t("cat_variantesCreees")}`
          : t("cat_varianteCreee"),
      );
      setSku("");
      setTaillesChoisies([]);
      setCouleursChoisies([]);
      setPrixAchat("");
      setPrixVente("");
      setStock("0");
      onAjoutee();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_ajoutImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.ajoutVariante}>
      <input
        placeholder={t("cat_placeholderReference")}
        value={sku}
        onChange={(e) => setSku(e.target.value)}
      />
      <SelecteurMultiple
        label={t("cat_tailles")}
        valeurs={options.sizes}
        selection={taillesChoisies}
        onChangeSelection={setTaillesChoisies}
        onAjouterValeur={(v) => ajouterOption("SIZE", v)}
      />
      <SelecteurMultiple
        label={t("cat_couleurs")}
        valeurs={options.colors}
        selection={couleursChoisies}
        onChangeSelection={setCouleursChoisies}
        onAjouterValeur={(v) => ajouterOption("COLOR", v)}
      />
      <input
        placeholder={t("cat_placeholderPrixAchat")}
        type="number"
        value={prixAchat}
        onChange={(e) => setPrixAchat(e.target.value)}
      />
      <input
        placeholder={t("cat_placeholderPrixVente")}
        type="number"
        value={prixVente}
        onChange={(e) => setPrixVente(e.target.value)}
      />
      <input
        placeholder={t("cat_placeholderStockInitial")}
        type="number"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <button className={styles.bouton} onClick={ajouter} disabled={enCours || !sku || !prixVente}>
        {nombreVariantes > 1 ? `${t("cat_creer")} ${nombreVariantes} ${t("cat_variantesMinuscule")}` : t("cat_ajouterVariante")}
      </button>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}
    </div>
  );
}

function CatalogueContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nomNouveau, setNomNouveau] = useState("");
  const [categorieNouveau, setCategorieNouveau] = useState("");
  // 20 oct. 2026 (demande : "ajouter à chaque produit un champ description
  // qui sera également visible sur la marketplace") — le champ existait déjà
  // en base et côté API (Product.description, create/update-product.dto.ts),
  // seule l'interface de saisie manquait.
  const [descriptionNouveau, setDescriptionNouveau] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [creationConfirmee, setCreationConfirmee] = useState(false);
  const [recherche, setRecherche] = useState("");

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Product[]>(`/shops/${currentShop.id}/products`)
      .then(setProduits)
      .catch((err) => setErreur(err instanceof Error ? err.message : t("cmd_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function publier(produitId: string) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/publish`, { productIds: [produitId] });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_publicationImpossible"));
    }
  }

  async function depublier(produitId: string) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/unpublish`, { productIds: [produitId] });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_retraitImpossible"));
    }
  }

  /**
   * Mécanisme de promotion — corrigé le 20 oct. 2026 (signalement : "J'ai
   * défini une promotion mais qui ne marche", saisie "30" sur un article à
   * $38). Cause réelle : la première version demandait le PRIX BARRÉ
   * (l'ancien prix, plus élevé) plutôt que le nouveau prix promo, et une
   * valeur invalide était ignorée sans aucun message. Corrigé sur les deux
   * points : on demande maintenant le prix promo réel (ce que l'acheteur
   * paiera), le prix actuel devient automatiquement le prix barré, et toute
   * erreur de l'API s'affiche désormais au lieu d'échouer en silence.
   */
  async function modifierPrixBarre(produitId: string, variante: Variant) {
    if (!currentShop) return;
    const prixActuel = Number(variante.sellPrice);
    const enPromoActuellement = variante.compareAtPrice != null;
    const saisie = window.prompt(
      enPromoActuellement
        ? `${t("cat_promoInvite")} (${t("cat_promoActuelle")} ${formatMoney(prixActuel, variante.currency)} ${t("cat_promoAncienPrix")} ${formatMoney(Number(variante.compareAtPrice), variante.currency)})`
        : `${t("cat_promoInvite")} (${t("cat_promoPrixActuel")} ${formatMoney(prixActuel, variante.currency)})`,
      "",
    );
    if (saisie === null) return; // annulé
    const valeur = saisie.trim();
    setErreur(null);
    try {
      if (valeur === "") {
        // Retire la promotion : remet le prix d'origine (le prix barré
        // mémorisé) comme prix de vente, et efface le prix barré.
        if (enPromoActuellement) {
          await api.patch(`/shops/${currentShop.id}/products/${produitId}/variants/${variante.id}`, {
            sellPrice: Number(variante.compareAtPrice),
            compareAtPrice: null,
          });
          recharger();
        }
        return;
      }
      const nouveauPrix = Number(valeur);
      if (!Number.isFinite(nouveauPrix) || nouveauPrix <= 0) {
        setErreur(t("cat_promoPrixInvalide"));
        return;
      }
      if (nouveauPrix >= prixActuel) {
        setErreur(t("cat_promoDoitEtreInferieur"));
        return;
      }
      await api.patch(`/shops/${currentShop.id}/products/${produitId}/variants/${variante.id}`, {
        sellPrice: nouveauPrix,
        compareAtPrice: prixActuel,
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_promoImpossible"));
    }
  }

  /**
   * Édition des champs d'une variante et d'un article après leur création
   * (20 oct. 2026 — signalement : "les différents champs dans catalogue dès
   * que saisie on ne peut pas les modifier"). Avant ce correctif, seuls le
   * prix de vente (via la promo) pouvaient changer après coup ; une
   * référence, taille, couleur ou prix d'achat mal saisis obligeaient à
   * supprimer puis recréer la variante. `patchVariante` factorise l'appel
   * API commun à tous les champs ci-dessous.
   */
  async function patchVariante(
    produitId: string,
    varianteId: string,
    patch: Record<string, unknown>,
    cleErreur: string,
  ) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produitId}/variants/${varianteId}`, patch);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t(cleErreur));
    }
  }

  function modifierReference(produitId: string, variante: Variant) {
    const saisie = window.prompt(t("cat_inviteReference"), variante.sku);
    if (saisie === null) return;
    const valeur = saisie.trim();
    if (!valeur) {
      setErreur(t("cat_referenceVide"));
      return;
    }
    if (valeur === variante.sku) return;
    patchVariante(produitId, variante.id, { sku: valeur }, "cat_referenceImpossible");
  }

  function modifierTailleCouleur(produitId: string, variante: Variant) {
    const taille = window.prompt(t("cat_inviteTaille"), variante.size ?? "");
    if (taille === null) return;
    const couleur = window.prompt(t("cat_inviteCouleur"), variante.color ?? "");
    if (couleur === null) return;
    patchVariante(
      produitId,
      variante.id,
      { size: taille.trim() || null, color: couleur.trim() || null },
      "cat_tailleCouleurImpossible",
    );
  }

  function modifierPrixAchat(produitId: string, variante: Variant) {
    const saisie = window.prompt(
      t("cat_invitePrixAchat"),
      variante.costPrice != null ? String(variante.costPrice) : "",
    );
    if (saisie === null) return;
    const valeur = saisie.trim();
    if (valeur === "") {
      patchVariante(produitId, variante.id, { costPrice: null }, "cat_prixAchatImpossible");
      return;
    }
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre) || nombre < 0) {
      setErreur(t("cat_promoPrixInvalide"));
      return;
    }
    patchVariante(produitId, variante.id, { costPrice: nombre }, "cat_prixAchatImpossible");
  }

  function modifierPrixVente(produitId: string, variante: Variant) {
    const saisie = window.prompt(t("cat_invitePrixVente"), variante.sellPrice);
    if (saisie === null) return;
    const nombre = Number(saisie.trim());
    if (!Number.isFinite(nombre) || nombre <= 0) {
      setErreur(t("cat_promoPrixInvalide"));
      return;
    }
    patchVariante(produitId, variante.id, { sellPrice: nombre }, "cat_prixVenteImpossible");
  }

  /**
   * Ajustement manuel du stock (20 oct. 2026 — suite de la question "le
   * champ stock n'est toujours pas éditable"). Volontairement une action à
   * part (pas un simple champ ✎ comme les autres) : elle passe par
   * /stock-adjustment, qui enregistre toujours un mouvement de stock
   * traçable avec un motif, plutôt qu'un PATCH direct sur stockQty qui
   * romprait l'historique et la valorisation CUMP (voir le commentaire de
   * CatalogService.adjustStock).
   */
  async function ajusterStock(produitId: string, variante: Variant) {
    if (!currentShop) return;
    const saisie = window.prompt(t("cat_inviteNouvelleQuantite"), String(variante.stockQty));
    if (saisie === null) return;
    const nouvelleQuantite = Number(saisie.trim());
    if (!Number.isInteger(nouvelleQuantite) || nouvelleQuantite < 0) {
      setErreur(t("cat_quantiteInvalide"));
      return;
    }
    if (nouvelleQuantite === variante.stockQty) return;
    const motif = window.prompt(t("cat_inviteMotifAjustement"), "");
    if (motif === null) return; // annulé au deuxième prompt
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/products/${produitId}/variants/${variante.id}/stock-adjustment`, {
        newQty: nouvelleQuantite,
        reason: motif.trim() || undefined,
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_ajustementImpossible"));
    }
  }

  async function modifierNomProduit(produit: Product) {
    if (!currentShop) return;
    const saisie = window.prompt(t("cat_inviteNomArticle"), produit.name);
    if (saisie === null) return;
    const valeur = saisie.trim();
    if (!valeur) {
      setErreur(t("cat_nomVide"));
      return;
    }
    if (valeur === produit.name) return;
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produit.id}`, { name: valeur });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_modificationArticleImpossible"));
    }
  }

  async function modifierCategorieProduit(produit: Product) {
    if (!currentShop) return;
    const saisie = window.prompt(t("cat_inviteCategorieArticle"), produit.category ?? "");
    if (saisie === null) return;
    const valeur = saisie.trim();
    if (!valeur) {
      setErreur(t("cat_categorieVide"));
      return;
    }
    if (valeur === produit.category) return;
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produit.id}`, { category: valeur });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_modificationArticleImpossible"));
    }
  }

  // 20 oct. 2026 — contrairement au nom/catégorie, une description vide est
  // valide (elle masque simplement le paragraphe sur la fiche marketplace) :
  // pas de contrôle "non vide" ici, `null` plutôt que "" pour bien l'effacer
  // côté base (cohérent avec `compareAtPrice: null` ailleurs dans ce fichier).
  async function modifierDescriptionProduit(produit: Product) {
    if (!currentShop) return;
    const saisie = window.prompt(t("cat_inviteDescriptionArticle"), produit.description ?? "");
    if (saisie === null) return;
    const valeur = saisie.trim();
    if (valeur === (produit.description ?? "")) return;
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/products/${produit.id}`, { description: valeur || null });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_modificationArticleImpossible"));
    }
  }

  async function creerProduit() {
    if (!currentShop || !nomNouveau) return;
    setCreationEnCours(true);
    setCreationConfirmee(false);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/products`, {
        name: nomNouveau,
        category: categorieNouveau || undefined,
        description: descriptionNouveau || undefined,
      });
      setNomNouveau("");
      setCategorieNouveau("");
      setDescriptionNouveau("");
      recharger();
      // Confirmation explicite (16 oct. 2026) : auparavant, rien ne
      // distinguait "enregistré" de "pas encore cliqué" une fois le
      // formulaire vidé — message transitoire, effacé dès la prochaine
      // action pour ne pas s'accumuler à l'écran.
      setCreationConfirmee(true);
      setTimeout(() => setCreationConfirmee(false), 4000);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cat_creationImpossible"));
    } finally {
      setCreationEnCours(false);
    }
  }

  const produitsVisibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter((p) => {
      const texte = `${p.name} ${p.category ?? ""} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase();
      return texte.includes(q);
    });
  }, [produits, recherche]);

  return (
    <div>
      <div className={styles.enteteTitre}>
        <h1 className={styles.titre}>{t("cat_titre")}</h1>
        <BoutonBientotDisponible icone="🪄" label={t("cat_studioPublicitaire")} />
      </div>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <ImportExportExcel onImporte={recharger} />

      <input
        className={styles.recherche}
        type="text"
        placeholder={t("cat_placeholderRechercheArticle")}
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      <div className={styles.nouveauProduit}>
        <div className={styles.champ}>
          <label htmlFor="nom">{t("cat_nouvelArticle")}</label>
          <input
            id="nom"
            placeholder={t("cat_placeholderNomArticle")}
            value={nomNouveau}
            onChange={(e) => setNomNouveau(e.target.value)}
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="categorie">{t("cat_categorie")}</label>
          <SelecteurCategorie valeur={categorieNouveau} onChange={setCategorieNouveau} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="description">{t("cat_descriptionArticle")}</label>
          <textarea
            id="description"
            placeholder={t("cat_placeholderDescriptionArticle")}
            value={descriptionNouveau}
            onChange={(e) => setDescriptionNouveau(e.target.value)}
            rows={3}
          />
        </div>
        <button className={styles.bouton} onClick={creerProduit} disabled={creationEnCours || !nomNouveau}>
          {creationEnCours ? t("cat_creationEnCours") : t("cat_creerArticle")}
        </button>
        {creationConfirmee && <div className={styles.confirmation}>{t("cat_creationReussie")}</div>}
      </div>

      {chargement ? (
        <p>{t("caisse_chargementCatalogue")}</p>
      ) : produitsVisibles.length === 0 ? (
        <p>
          {produits.length === 0
            ? t("cat_aucunArticle")
            : t("cat_aucunResultatRecherche")}
        </p>
      ) : (
        produitsVisibles.map((produit) => (
          <div className={styles.produit} key={produit.id}>
            <div className={styles.produitEntete}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong>{produit.name}</strong>
                <button
                  type="button"
                  className={styles.boutonCrayon}
                  style={{ color: "rgba(255,255,255,0.75)" }}
                  title={t("cat_modifier")}
                  onClick={() => modifierNomProduit(produit)}
                >
                  ✎
                </button>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {produit.category ?? t("cat_sansCategorie")}
                  <button
                    type="button"
                    className={styles.boutonCrayon}
                    style={{ color: "rgba(255,255,255,0.75)" }}
                    title={t("cat_modifier")}
                    onClick={() => modifierCategorieProduit(produit)}
                  >
                    ✎
                  </button>
                </span>
                {produit.isPublished ? (
                  <>
                    <StatusTag label={t("cat_publieSurMarketplace")} humeur="paye" />
                    <button
                      className={styles.bouton}
                      style={{ padding: "6px 12px", minHeight: "32px", background: "var(--color-flamme)" }}
                      onClick={() => depublier(produit.id)}
                    >
                      {t("cat_retirerDeLaMarketplace")}
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.bouton}
                    style={{ padding: "6px 12px", minHeight: "32px" }}
                    onClick={() => publier(produit.id)}
                  >
                    {t("cat_publierSurLaMarketplace")}
                  </button>
                )}
              </span>
            </div>
            <p
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "0.875rem",
                color: "var(--color-texte-muted)",
                margin: "4px 0 var(--espace-2)",
              }}
            >
              <span>{produit.description || t("cat_sansDescription")}</span>
              <button
                type="button"
                className={styles.boutonCrayon}
                title={t("cat_modifier")}
                onClick={() => modifierDescriptionProduit(produit)}
              >
                ✎
              </button>
            </p>
            <ImagesProduit produit={produit} onChange={recharger} />
            {produit.variants.length > 0 && (
              <table className={styles.tableauVariantes}>
                <thead>
                  <tr>
                    <th>{t("cat_colReference")}</th>
                    <th>{t("cat_colTailleCouleur")}</th>
                    <th className={styles.colChiffre}>{t("cat_colPrixAchat")}</th>
                    <th className={styles.colChiffre}>{t("cat_colPrixVente")}</th>
                    <th className={styles.colChiffre}>{t("cat_colPromo")}</th>
                    <th className={styles.colChiffre}>{t("cat_colStock")}</th>
                  </tr>
                </thead>
                <tbody>
                  {produit.variants.map((v) => {
                    const remise = pourcentageRemise(Number(v.sellPrice), v.compareAtPrice);
                    return (
                      <tr key={v.id}>
                        <td>
                          {v.sku}{" "}
                          <button
                            type="button"
                            className={styles.boutonCrayon}
                            title={t("cat_modifier")}
                            onClick={() => modifierReference(produit.id, v)}
                          >
                            ✎
                          </button>
                        </td>
                        <td>
                          {[v.size, v.color].filter(Boolean).join(" · ") || "—"}{" "}
                          <button
                            type="button"
                            className={styles.boutonCrayon}
                            title={t("cat_modifier")}
                            onClick={() => modifierTailleCouleur(produit.id, v)}
                          >
                            ✎
                          </button>
                        </td>
                        <td className={styles.colChiffre}>
                          {v.costPrice != null ? formatMoney(Number(v.costPrice), v.currency) : "—"}{" "}
                          <button
                            type="button"
                            className={styles.boutonCrayon}
                            title={t("cat_modifier")}
                            onClick={() => modifierPrixAchat(produit.id, v)}
                          >
                            ✎
                          </button>
                        </td>
                        <td className={styles.colChiffre}>
                          {formatMoney(Number(v.sellPrice), v.currency)}{" "}
                          <button
                            type="button"
                            className={styles.boutonCrayon}
                            title={t("cat_modifier")}
                            onClick={() => modifierPrixVente(produit.id, v)}
                          >
                            ✎
                          </button>
                        </td>
                        <td className={styles.colChiffre}>
                          <button
                            type="button"
                            className={styles.bouton}
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                            onClick={() => modifierPrixBarre(produit.id, v)}
                          >
                            {remise != null ? `-${remise}% ✎` : t("cat_definirPromo")}
                          </button>
                        </td>
                        <td className={styles.colChiffre}>
                          {v.stockQty}{" "}
                          <button
                            type="button"
                            className={styles.boutonCrayon}
                            title={t("cat_ajusterStock")}
                            onClick={() => ajusterStock(produit.id, v)}
                          >
                            ✎
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <NouvelleVariante produitId={produit.id} onAjoutee={recharger} />
          </div>
        ))
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <ProtectedGestionPage>
      <CatalogueContent />
    </ProtectedGestionPage>
  );
}
