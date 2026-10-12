"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { ajouterOperation } from "../../lib/offline-queue";
import { useOfflineSync } from "../../lib/offline-sync";
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

// Choix du format de document à l'encaissement (demande du 12 oct. 2026,
// n°3 : les deux formats — non homologué et fiscal homologué — doivent être
// proposés au choix). INVOICE_FISCAL n'apparaît que si l'homologation DGI de
// la boutique a été confirmée par l'administration (voir
// fiscalHomologationConfirmed, docs/COMPLIANCE_FACTURE_NORMALISEE.md) ; les
// autres types restent toujours disponibles.
const TYPES_DOCUMENT: { valeur: string; label: string; reserveHomologation?: boolean }[] = [
  { valeur: "TICKET", label: "Ticket de caisse" },
  { valeur: "RECEIPT", label: "Reçu" },
  { valeur: "INVOICE_INTERNAL", label: "Facture interne" },
  { valeur: "INVOICE_FISCAL", label: "Facture fiscale homologuée", reserveHomologation: true },
];

function CaisseContent() {
  const { currentShop } = useShop();
  const { rafraichirCompteur, synchroniser } = useOfflineSync();
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [moyen, setMoyen] = useState<(typeof MOYENS)[number]["valeur"]>("CASH");
  const [typeDocument, setTypeDocument] = useState<string>("TICKET");
  const [homologationConfirmee, setHomologationConfirmee] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurVente, setErreurVente] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [dernierTicket, setDernierTicket] = useState<{ shopId: string; documentId: string } | null>(
    null,
  );
  const [impressionEnCours, setImpressionEnCours] = useState(false);

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

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    api
      .get<{ fiscalHomologationConfirmed: boolean }>(`/shops/${currentShop.id}`)
      .then((data) => {
        if (!annule) setHomologationConfirmee(Boolean(data.fiscalHomologationConfirmed));
      })
      .catch(() => {
        // Non bloquant pour la caisse : par défaut la facture fiscale reste
        // simplement masquée du choix si cette information est indisponible.
      });
    return () => {
      annule = true;
    };
  }, [currentShop]);

  const typesDisponibles = useMemo(
    () => TYPES_DOCUMENT.filter((t) => !t.reserveHomologation || homologationConfirmee),
    [homologationConfirmee],
  );

  useEffect(() => {
    if (!typesDisponibles.some((t) => t.valeur === typeDocument)) {
      setTypeDocument("TICKET");
    }
  }, [typesDisponibles, typeDocument]);

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
    setDernierTicket(null);

    const payload = {
      lines: lignes.map((l) => ({
        variantId: l.variantId,
        label: l.label,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      payments: [{ method: moyen, amount: total }],
      currency: devise,
    };

    try {
      const vente = await api.post<{ id: string }>(`/shops/${currentShop.id}/pos/sales`, payload);
      setConfirmation(`Vente enregistrée — ${formatMoney(total, devise)} encaissé.`);
      setLignes([]);
      try {
        const document = await api.post<{ id: string }>(
          `/shops/${currentShop.id}/documents/pos-sale/${vente.id}`,
          { type: typeDocument },
        );
        setDernierTicket({ shopId: currentShop.id, documentId: document.id });
      } catch {
        // La vente est enregistrée même si la génération du ticket échoue —
        // ne jamais bloquer l'encaissement pour un problème d'impression.
      }
      return;
    } catch (err) {
      // statusCode === 0 : le serveur est inatteignable (coupure réseau),
      // pas un refus — on bascule sur la file hors-ligne plutôt que de
      // faire perdre la vente au commerçant (docs/ARCHITECTURE_HORS_LIGNE.md).
      if (err instanceof ApiError && err.statusCode === 0) {
        try {
          const clientOperationId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await ajouterOperation({
            clientOperationId,
            shopId: currentShop.id,
            type: "POS_SALE",
            payload,
            createdAtClient: new Date().toISOString(),
            tentatives: 0,
          });
          await rafraichirCompteur();
          setConfirmation(
            `Vente enregistrée hors-ligne — ${formatMoney(total, devise)}. Elle se synchronisera automatiquement dès le retour du réseau.`,
          );
          setLignes([]);
          synchroniser();
        } catch {
          setErreurVente(
            "Pas de réseau et la vente n'a pas pu être mise en attente localement — notez-la manuellement.",
          );
        }
      } else {
        setErreurVente(err instanceof ApiError ? err.message : "La vente n'a pas pu être enregistrée.");
      }
    } finally {
      setEnCours(false);
    }
  }

  async function imprimerDernierTicket() {
    if (!dernierTicket) return;
    setImpressionEnCours(true);
    try {
      await ouvrirDocumentPdf(
        `/shops/${dernierTicket.shopId}/documents/${dernierTicket.documentId}/pdf`,
      );
    } catch {
      setErreurVente("Le ticket n'a pas pu être ouvert pour impression.");
    } finally {
      setImpressionEnCours(false);
    }
  }

  if (chargement) return <p>Chargement du catalogue…</p>;
  if (erreurChargement) return <p className={styles.erreur}>{erreurChargement}</p>;

  return (
    <div>
      <h1 className={styles.titre}>Caisse</h1>

      <div className={styles.disposition}>
        {/* Panneau articles — plus large, avec son propre défilement : une
            boutique au catalogue de plusieurs milliers d'articles ne doit
            jamais obliger à défiler toute la grille pour atteindre le ticket
            et le bouton d'encaissement, qui restent visibles à côté. */}
        <div className={styles.colonneArticles}>
          <input
            className={styles.recherche}
            type="text"
            placeholder="Chercher un article par nom, taille ou couleur…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />

          <div className={styles.zoneArticles}>
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
          </div>
        </div>

        {/* Panneau ticket — vertical, toujours visible à côté de la grille
            (prompt : "disposition verticale... comme un panneau"). */}
        <div className={styles.colonneTicket}>
          <div className={styles.ticket}>
            {lignes.length === 0 ? (
              <p className={styles.messageVide}>Le ticket est vide. Touchez un article à côté.</p>
            ) : (
              <div className={styles.ligneTicketListe}>
                {lignes.map((ligne, i) => (
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
                ))}
              </div>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                <label htmlFor="typeDocument" style={{ fontSize: "0.85rem" }}>
                  Document à imprimer
                </label>
                <select
                  id="typeDocument"
                  value={typeDocument}
                  onChange={(e) => setTypeDocument(e.target.value)}
                  style={{ padding: "8px 10px", minHeight: 40 }}
                >
                  {typesDisponibles.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {erreurVente && <div className={styles.erreur}>{erreurVente}</div>}
              {confirmation && (
                <div className={styles.confirmation}>
                  {confirmation}
                  {dernierTicket && (
                    <>
                      {" — "}
                      <button
                        onClick={imprimerDernierTicket}
                        disabled={impressionEnCours}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#fff",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: 0,
                          font: "inherit",
                        }}
                      >
                        Imprimer le ticket
                      </button>
                    </>
                  )}
                </div>
              )}
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
