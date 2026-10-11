"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

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

function NouvelleVariante({ produitId, onAjoutee }: { produitId: string; onAjoutee: () => void }) {
  const { currentShop } = useShop();
  const [sku, setSku] = useState("");
  const [taille, setTaille] = useState("");
  const [couleur, setCouleur] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [stock, setStock] = useState("0");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ajouter() {
    if (!currentShop || !sku || !prixVente) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop.id}/products/${produitId}/variants`, {
        sku,
        size: taille || undefined,
        color: couleur || undefined,
        costPrice: prixAchat ? Number(prixAchat) : undefined,
        sellPrice: Number(prixVente),
        initialStockQty: stock ? Number(stock) : 0,
      });
      setSku("");
      setTaille("");
      setCouleur("");
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
      <input placeholder="Référence (SKU)" value={sku} onChange={(e) => setSku(e.target.value)} />
      <input placeholder="Taille" value={taille} onChange={(e) => setTaille(e.target.value)} />
      <input placeholder="Couleur" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
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
        placeholder="Stock initial"
        type="number"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <button className={styles.bouton} onClick={ajouter} disabled={enCours || !sku || !prixVente}>
        Ajouter la variante
      </button>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
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

  return (
    <div>
      <h1 className={styles.titre}>Catalogue</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

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
      ) : produits.length === 0 ? (
        <p>Aucun article pour l&apos;instant. Créez-en un ci-dessus.</p>
      ) : (
        produits.map((produit) => (
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
