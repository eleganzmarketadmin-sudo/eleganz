"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { telechargerFichier, envoyerFichier } from "../../lib/telecharger-fichier";
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
      setErreur(err instanceof Error ? err.message : "Téléchargement impossible.");
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
      setErreur(err instanceof Error ? err.message : "Export impossible.");
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
      setErreur(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className={styles.blocImport}>
      <h2 className={styles.sousTitre}>Importer ou exporter en masse (Excel)</h2>
      <p className={styles.texteAide}>
        Ajoutez des dizaines d&apos;articles d&apos;un coup à partir d&apos;un fichier Excel, dans
        l&apos;ordre de colonnes de la plateforme — téléchargez le gabarit, remplissez-le, puis
        importez-le. Une référence déjà connue de votre boutique est mise à jour (prix, stock) au
        lieu d&apos;être dupliquée.
      </p>
      <div className={styles.actionsImport}>
        <button className={styles.boutonSecondaire} onClick={telechargerGabarit} disabled={enCours !== null}>
          {enCours === "gabarit" ? "…" : "Télécharger le gabarit"}
        </button>
        <button className={styles.boutonSecondaire} onClick={exporterCatalogue} disabled={enCours !== null}>
          {enCours === "export" ? "…" : "Exporter mon catalogue (.xlsx)"}
        </button>
        <label
          className={styles.bouton}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", minHeight: "40px" }}
        >
          {enCours === "import" ? "Import en cours…" : "Importer un fichier Excel"}
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
            <strong>{resultat.creees}</strong> créé(s), <strong>{resultat.misesAJour}</strong> mis à
            jour, <strong>{resultat.erreurs}</strong> erreur(s) sur {resultat.resultats.length} ligne(s).
          </p>
          {resultat.erreurs > 0 && (
            <ul className={styles.listeErreursImport}>
              {resultat.resultats
                .filter((r) => r.statut === "erreur")
                .map((r, i) => (
                  <li key={i}>
                    Ligne {r.ligne}{r.sku ? ` (${r.sku})` : ""} : {r.message}
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
  currency: string;
  stockQty: number;
}

interface Product {
  id: string;
  name: string;
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
      setErreur(err instanceof ApiError ? err.message : "Image refusée (doit être une URL valide).");
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
        throw new Error("Le fichier n'a pas pu être envoyé au stockage.");
      }
      await sauvegarder([...produit.images, publicUrl]);
    } catch (err) {
      setErreur(err instanceof ApiError || err instanceof Error ? err.message : "Envoi de la photo impossible.");
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
            aria-label="Retirer l'image"
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
        Téléverser une photo
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
        <summary style={{ cursor: "pointer", color: "var(--color-cobalt)" }}>ou coller une URL existante</summary>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <input
            placeholder="URL d'une photo déjà hébergée ailleurs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ minWidth: "260px", padding: "8px", border: "1px solid var(--color-border)" }}
          />
          <button className={styles.bouton} style={{ minHeight: "40px" }} onClick={ajouterImage} disabled={enCours || !url}>
            Ajouter
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
          placeholder={`+ nouvelle valeur`}
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
          Ajouter
        </button>
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>
        Ctrl/Cmd + clic pour sélectionner plusieurs valeurs — une variante sera créée par
        combinaison.
      </span>
    </div>
  );
}

function NouvelleVariante({ produitId, onAjoutee }: { produitId: string; onAjoutee: () => void }) {
  const { currentShop } = useShop();
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
        variantes.length > 1 ? `${variantes.length} variantes créées.` : "Variante créée.",
      );
      setSku("");
      setTaillesChoisies([]);
      setCouleursChoisies([]);
      setPrixAchat("");
      setPrixVente("");
      setStock("0");
      onAjoutee();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Ajout impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.ajoutVariante}>
      <input
        placeholder="Référence (SKU) — préfixe si plusieurs tailles/couleurs"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
      />
      <SelecteurMultiple
        label="Tailles"
        valeurs={options.sizes}
        selection={taillesChoisies}
        onChangeSelection={setTaillesChoisies}
        onAjouterValeur={(v) => ajouterOption("SIZE", v)}
      />
      <SelecteurMultiple
        label="Couleurs"
        valeurs={options.colors}
        selection={couleursChoisies}
        onChangeSelection={setCouleursChoisies}
        onAjouterValeur={(v) => ajouterOption("COLOR", v)}
      />
      <input
        placeholder="Prix d'achat"
        type="number"
        value={prixAchat}
        onChange={(e) => setPrixAchat(e.target.value)}
      />
      <input
        placeholder="Prix de vente"
        type="number"
        value={prixVente}
        onChange={(e) => setPrixVente(e.target.value)}
      />
      <input
        placeholder="Stock initial (par variante)"
        type="number"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <button className={styles.bouton} onClick={ajouter} disabled={enCours || !sku || !prixVente}>
        {nombreVariantes > 1 ? `Créer ${nombreVariantes} variantes` : "Ajouter la variante"}
      </button>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}
    </div>
  );
}

function CatalogueContent() {
  const { currentShop } = useShop();
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nomNouveau, setNomNouveau] = useState("");
  const [categorieNouveau, setCategorieNouveau] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [recherche, setRecherche] = useState("");

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<Product[]>(`/shops/${currentShop.id}/products`)
      .then(setProduits)
      .catch((err) => setErreur(err instanceof Error ? err.message : "Erreur."))
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
      setErreur(err instanceof ApiError ? err.message : "Publication impossible.");
    }
  }

  async function depublier(produitId: string) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/unpublish`, { productIds: [produitId] });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Retrait impossible.");
    }
  }

  async function creerProduit() {
    if (!currentShop || !nomNouveau) return;
    setCreationEnCours(true);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/products`, {
        name: nomNouveau,
        category: categorieNouveau || undefined,
      });
      setNomNouveau("");
      setCategorieNouveau("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
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
      <h1 className={styles.titre}>Catalogue</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <ImportExportExcel onImporte={recharger} />

      <input
        className={styles.recherche}
        type="text"
        placeholder="Chercher un article par nom, catégorie ou référence…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      <div className={styles.nouveauProduit}>
        <div className={styles.champ}>
          <label htmlFor="nom">Nouvel article</label>
          <input
            id="nom"
            placeholder="Ex. Robe wax bleue"
            value={nomNouveau}
            onChange={(e) => setNomNouveau(e.target.value)}
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="categorie">Catégorie</label>
          <input
            id="categorie"
            placeholder="Ex. Robes"
            value={categorieNouveau}
            onChange={(e) => setCategorieNouveau(e.target.value)}
          />
        </div>
        <button className={styles.bouton} onClick={creerProduit} disabled={creationEnCours || !nomNouveau}>
          Créer l&apos;article
        </button>
      </div>

      {chargement ? (
        <p>Chargement du catalogue…</p>
      ) : produitsVisibles.length === 0 ? (
        <p>
          {produits.length === 0
            ? "Aucun article pour l'instant. Importez un fichier Excel ou créez-en un ci-dessus."
            : "Aucun article ne correspond à la recherche."}
        </p>
      ) : (
        produitsVisibles.map((produit) => (
          <div className={styles.produit} key={produit.id}>
            <div className={styles.produitEntete}>
              <strong>{produit.name}</strong>
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {produit.category ?? "Sans catégorie"}
                {produit.isPublished ? (
                  <>
                    <StatusTag label="Publié sur la Marketplace" humeur="paye" />
                    <button
                      className={styles.bouton}
                      style={{ padding: "6px 12px", minHeight: "32px", background: "var(--color-flamme)" }}
                      onClick={() => depublier(produit.id)}
                    >
                      Retirer de la Marketplace
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.bouton}
                    style={{ padding: "6px 12px", minHeight: "32px" }}
                    onClick={() => publier(produit.id)}
                  >
                    Publier sur la Marketplace
                  </button>
                )}
              </span>
            </div>
            <ImagesProduit produit={produit} onChange={recharger} />
            {produit.variants.length > 0 && (
              <table className={styles.tableauVariantes}>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Taille / couleur</th>
                    <th className={styles.colChiffre}>Prix d&apos;achat</th>
                    <th className={styles.colChiffre}>Prix de vente</th>
                    <th className={styles.colChiffre}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {produit.variants.map((v) => (
                    <tr key={v.id}>
                      <td>{v.sku}</td>
                      <td>{[v.size, v.color].filter(Boolean).join(" · ") || "—"}</td>
                      <td className={styles.colChiffre}>
                        {v.costPrice != null ? formatMoney(Number(v.costPrice), v.currency) : "—"}
                      </td>
                      <td className={styles.colChiffre}>{formatMoney(Number(v.sellPrice), v.currency)}</td>
                      <td className={styles.colChiffre}>{v.stockQty}</td>
                    </tr>
                  ))}
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
