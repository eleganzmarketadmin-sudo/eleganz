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
}

interface ShopOrder {
  id: string;
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
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
