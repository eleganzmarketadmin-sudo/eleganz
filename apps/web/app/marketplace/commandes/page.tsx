"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/money";
import { StatusTag } from "../../components/StatusTag";
import styles from "./page.module.css";

interface OrderLine {
  id: string;
  quantity: number;
  unitPrice: string;
  variant?: { product: { id: string; name: string } };
}

interface ShopOrder {
  id: string;
  shopId: string;
  status: string;
  subtotal: string;
  lines: OrderLine[];
}

interface Order {
  id: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  shopOrders: ShopOrder[];
}

const HUMEUR_PAR_STATUT: Record<string, "paye" | "attente" | "alerte" | "neutre"> = {
  CREATED: "attente",
  PAYMENT_PENDING: "attente",
  PAYMENT_CONFIRMED: "neutre",
  ACCEPTED: "neutre",
  PREPARING: "neutre",
  READY_FOR_PICKUP: "neutre",
  PICKED_UP: "neutre",
  IN_TRANSIT: "neutre",
  DELIVERED_DECLARED: "neutre",
  RECEIVED_CONFIRMED: "paye",
  CLOSED: "paye",
  CANCELLED: "alerte",
  DISPUTED: "alerte",
  RETURN_REQUESTED: "alerte",
  REFUNDED: "alerte",
};

const LABELS_STATUT: Record<string, string> = {
  CREATED: "Créée",
  PAYMENT_PENDING: "Paiement en attente",
  PAYMENT_CONFIRMED: "Paiement confirmé",
  ACCEPTED: "Acceptée par la boutique",
  PREPARING: "En préparation",
  READY_FOR_PICKUP: "Prête pour l'enlèvement",
  PICKED_UP: "Récupérée par le livreur",
  IN_TRANSIT: "En livraison",
  DELIVERED_DECLARED: "Livraison déclarée",
  RECEIVED_CONFIRMED: "Réception confirmée",
  CLOSED: "Terminée",
  CANCELLED: "Annulée",
  DISPUTED: "En litige",
  RETURN_REQUESTED: "Retour demandé",
  REFUNDED: "Remboursée",
};

export default function CommandesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [commandes, setCommandes] = useState<Order[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [avisPour, setAvisPour] = useState<ShopOrder | null>(null);
  const [noteAvis, setNoteAvis] = useState(0);
  const [commentaireAvis, setCommentaireAvis] = useState("");
  const [avisEnvoyesPour, setAvisEnvoyesPour] = useState<Set<string>>(new Set());
  const [envoiAvisEnCours, setEnvoiAvisEnCours] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/marketplace/compte?retour=/marketplace/commandes");
    }
  }, [authLoading, user, router]);

  function recharger() {
    if (!user) return;
    api
      .get<Order[]>("/marketplace/orders/mine")
      .then(setCommandes)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [user]);

  async function confirmerReception(shopOrderId: string) {
    setEnCours(shopOrderId);
    try {
      await api.post(`/marketplace/orders/${shopOrderId}/confirm-receipt`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Confirmation impossible.");
    } finally {
      setEnCours(null);
    }
  }

  function ouvrirAvis(so: ShopOrder) {
    setAvisPour(so);
    setNoteAvis(0);
    setCommentaireAvis("");
    setErreur(null);
  }

  async function envoyerAvis() {
    if (!avisPour || !noteAvis) {
      setErreur("Choisissez une note avant d'envoyer.");
      return;
    }
    setEnvoiAvisEnCours(true);
    setErreur(null);
    try {
      await api.post(`/marketplace/shops/${avisPour.shopId}/reviews`, {
        shopOrderId: avisPour.id,
        productId: avisPour.lines[0]?.variant?.product.id,
        rating: noteAvis,
        comment: commentaireAvis.trim() || undefined,
      });
      setAvisEnvoyesPour((prev) => new Set(prev).add(avisPour.id));
      setAvisPour(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "L'avis n'a pas pu être envoyé.");
    } finally {
      setEnvoiAvisEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>Mes commandes</h1>

      {chargement ? (
        <p>Chargement…</p>
      ) : erreur ? (
        <p>{erreur}</p>
      ) : commandes.length === 0 ? (
        <p className={styles.messageVide}>
          Aucune commande encore. <Link href="/marketplace">Parcourir la vitrine</Link>.
        </p>
      ) : (
        commandes.map((commande) => (
          <div className={styles.commande} key={commande.id}>
            <div className={styles.entete}>
              <span>{formatDate(commande.createdAt)}</span>
              <span className="chiffre">{formatMoney(Number(commande.totalAmount), commande.currency)}</span>
            </div>
            {commande.shopOrders.map((so) => (
              <div className={styles.sousCommande} key={so.id}>
                <span>{so.lines.length} article(s)</span>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <StatusTag
                    label={LABELS_STATUT[so.status] ?? so.status}
                    humeur={HUMEUR_PAR_STATUT[so.status] ?? "neutre"}
                  />
                  {so.status === "DELIVERED_DECLARED" && (
                    <button
                      disabled={enCours === so.id}
                      onClick={() => confirmerReception(so.id)}
                      style={{
                        border: "2px solid var(--color-vert-paiement)",
                        color: "var(--color-vert-paiement)",
                        background: "none",
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Confirmer la réception
                    </button>
                  )}
                  {["RECEIVED_CONFIRMED", "CLOSED"].includes(so.status) &&
                    (avisEnvoyesPour.has(so.id) ? (
                      <span style={{ color: "var(--color-vert-paiement)", fontSize: "0.8125rem" }}>Avis envoyé ✓</span>
                    ) : (
                      <button
                        onClick={() => ouvrirAvis(so)}
                        style={{
                          border: "2px solid var(--color-magenta)",
                          color: "var(--color-magenta)",
                          background: "none",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Laisser un avis
                      </button>
                    ))}
                </span>
              </div>
            ))}
          </div>
        ))
      )}

      {avisPour && (
        <div className={styles.modaleFond} onClick={() => setAvisPour(null)}>
          <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "12px" }}>Votre avis</h2>
            <div style={{ marginBottom: "12px" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNoteAvis(n)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    color: n <= noteAvis ? "var(--color-or)" : "var(--color-border)",
                    padding: "0 2px",
                  }}
                  aria-label={`${n} étoile(s)`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              placeholder="Votre expérience avec cette commande (optionnel)"
              value={commentaireAvis}
              onChange={(e) => setCommentaireAvis(e.target.value)}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid var(--color-border)", marginBottom: "12px" }}
            />
            {erreur && <div className={styles.erreur}>{erreur}</div>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={envoyerAvis}
                disabled={envoiAvisEnCours}
                style={{
                  background: "var(--color-magenta)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {envoiAvisEnCours ? "Envoi…" : "Publier l'avis"}
              </button>
              <button
                onClick={() => setAvisPour(null)}
                style={{ background: "none", border: "none", color: "var(--color-texte-muted)", cursor: "pointer" }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
