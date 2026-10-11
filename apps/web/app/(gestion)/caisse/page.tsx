"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

interface Variant {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  sellPrice: string;
  currency: string;
  stockQty: number;
}

interface Product {
  id: string;
  name: string;
  category?: string | null;
  variants: Variant[];
}

interface LigneTicket {
  variantId?: string;
  label: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

const MOYENS = [
  { valeur: "CASH", label: "Espèces" },
  { valeur: "MOBILE_MONEY", label: "Mobile money" },
] as const;

function CaisseContent() {
  const { currentShop } = useShop();
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [moyen, setMoyen] = useState<(typeof MOYENS)[number]["valeur"]>("CASH");
  const [enCours, setEnCours] = useState(false);
  const [erreurVente, setErreurVente] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    setChargement(true);
    api
      .get<Product[]>(`/shops/${currentShop.id}/products`)
      .then((data) => {
        if (!annule) setProduits(data);
      })
      .catch((err) => {
        if (!annule) setErreurChargement(err instanceof Error ? err.message : "Erreur.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop]);

  const variantesVisibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const sorties: { produit: Product; variante: Variant }[] = [];
    for (const produit of produits) {
      for (const variante of produit.variants) {
        const texte = `${produit.name} ${variante.sku} ${variante.size ?? ""} ${variante.color ?? ""}`.toLowerCase();
        if (!q || texte.includes(q)) {
          sorties.push({ produit, variante });
        }
      }
    }
    return sorties;
  }, [produits, recherche]);

  const devise = lignes[0]?.currency ?? "USD";
  const total = lignes.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  function ajouterVariante(produit: Product, variante: Variant) {
    setConfirmation(null);
    setLignes((prev) => {
      const existante = prev.find((l) => l.variantId === variante.id);
      if (existante) {
        return prev.map((l) =>
          l.variantId === variante.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          variantId: variante.id,
          label: `${produit.name}${variante.size ? " — " + variante.size : ""}${variante.color ? " " + variante.color : ""}`,
          quantity: 1,
          unitPrice: Number(variante.sellPrice),
          currency: variante.currency,
        },
      ];
    });
  }

  function modifierQuantite(index: number, quantite: number) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantity: Math.max(1, quantite) } : l)),
    );
  }

  function retirerLigne(index: number) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  async function encaisser() {
    if (!currentShop || lignes.length === 0) return;
    setEnCours(true);
    setErreurVente(null);
    try {
      await api.post(`/shops/${currentShop.id}/pos/sales`, {
        lines: lignes.map((l) => ({
          variantId: l.variantId,
          label: l.label,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        payments: [{ method: moyen, amount: total }],
        currency: devise,
      });
      setConfirmation(`Vente enregistrée — ${formatMoney(total, devise)} encaissé.`);
      setLignes([]);
    } catch (err) {
      setErreurVente(err instanceof ApiError ? err.message : "La vente n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>Chargement du catalogue…</p>;
  if (erreurChargement) return <p className={styles.erreur}>{erreurChargement}</p>;

  return (
    <div>
      <h1 className={styles.titre}>Caisse</h1>

      <input
        className={styles.recherche}
        type="text"
        placeholder="Chercher un article par nom, taille ou couleur…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      {variantesVisibles.length === 0 ? (
        <p className={styles.messageVide}>
          Aucun article ne correspond. Ajoutez des produits depuis le catalogue.
        </p>
      ) : (
        <div className={styles.grilleArticles}>
          {variantesVisibles.map(({ produit, variante }) => (
            <button
              key={variante.id}
              className={styles.carteArticle}
              disabled={variante.stockQty <= 0}
              onClick={() => ajouterVariante(produit, variante)}
            >
              <span className={styles.carteArticleNom}>{produit.name}</span>
              <span className={styles.carteArticleDetail}>
                {[variante.size, variante.color].filter(Boolean).join(" · ") || variante.sku}
                {" — "}
                {variante.stockQty > 0 ? `${variante.stockQty} en stock` : "épuisé"}
              </span>
              <span className={styles.carteArticlePrix}>
                {formatMoney(Number(variante.sellPrice), variante.currency)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.ticket}>
        {lignes.length === 0 ? (
          <p className={styles.messageVide}>Le ticket est vide. Touchez un article ci-dessus.</p>
        ) : (
          lignes.map((ligne, i) => (
            <div className={styles.ligneTicket} key={i}>
              <span className={styles.ligneTicketNom}>{ligne.label}</span>
              <input
                className={styles.ligneTicketQte}
                type="number"
                min={1}
                value={ligne.quantity}
                onChange={(e) => modifierQuantite(i, Number(e.target.value))}
              />
              <span className={styles.ligneTicketMontant}>
                {formatMoney(ligne.quantity * ligne.unitPrice, ligne.currency)}
              </span>
              <button
                className={styles.ligneTicketSupprimer}
                onClick={() => retirerLigne(i)}
                aria-label={`Retirer ${ligne.label}`}
              >
                ✕
              </button>
            </div>
          ))
        )}

        <div className={styles.totalLigne}>
          <span>Total</span>
          <span className="chiffre">{formatMoney(total, devise)}</span>
        </div>

        <div className={styles.paiements}>
          <div className={styles.moyensPaiement}>
            {MOYENS.map((m) => (
              <button
                key={m.valeur}
                className={`${styles.moyenBouton} ${moyen === m.valeur ? styles.moyenBoutonActif : ""}`}
                onClick={() => setMoyen(m.valeur)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {erreurVente && <div className={styles.erreur}>{erreurVente}</div>}
          {confirmation && <div className={styles.confirmation}>{confirmation}</div>}
        </div>
      </div>

      <div className={styles.barreAction}>
        <button
          className={styles.boutonEncaisser}
          disabled={lignes.length === 0 || enCours}
          onClick={encaisser}
        >
          {enCours ? "Enregistrement…" : `Enregistrer la vente — ${formatMoney(total, devise)}`}
        </button>
      </div>
    </div>
  );
}

export default function CaissePage() {
  return (
    <ProtectedGestionPage>
      <CaisseContent />
    </ProtectedGestionPage>
  );
}
