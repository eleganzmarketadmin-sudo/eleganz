"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import styles from "./page.module.css";

interface OrderLine {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  variant: { size: string | null; color: string | null; product: { name: string } };
}

interface ShopOrder {
  id: string;
  status: string;
  subtotal: string;
  createdAt: string;
  lines: OrderLine[];
  order: { id: string; createdAt: string };
}

// Reflet côté écran de ALLOWED_TRANSITIONS (orders.service.ts) — seulement
// les transitions qu'un membre de l'équipe déclenche lui-même ; la
// confirmation de réception reste un geste de l'acheteur.
const TRANSITIONS_STAFF: Record<string, { cible: string; label: string; annulation?: boolean }[]> = {
  CREATED: [
    { cible: "PAYMENT_PENDING", label: "Marquer paiement en attente" },
    { cible: "CANCELLED", label: "Annuler", annulation: true },
  ],
  PAYMENT_PENDING: [
    { cible: "PAYMENT_CONFIRMED", label: "Confirmer le paiement" },
    { cible: "CANCELLED", label: "Annuler", annulation: true },
  ],
  PAYMENT_CONFIRMED: [
    { cible: "ACCEPTED", label: "Accepter la commande" },
    { cible: "CANCELLED", label: "Annuler", annulation: true },
  ],
  ACCEPTED: [
    { cible: "PREPARING", label: "Commencer la préparation" },
    { cible: "CANCELLED", label: "Annuler", annulation: true },
  ],
  PREPARING: [{ cible: "READY_FOR_PICKUP", label: "Prête pour l'enlèvement" }],
  READY_FOR_PICKUP: [{ cible: "PICKED_UP", label: "Récupérée par le livreur" }],
  PICKED_UP: [{ cible: "IN_TRANSIT", label: "En livraison" }],
  IN_TRANSIT: [{ cible: "DELIVERED_DECLARED", label: "Déclarer la livraison" }],
};

const LABELS_STATUT: Record<string, string> = {
  CREATED: "Créée",
  PAYMENT_PENDING: "Paiement en attente",
  PAYMENT_CONFIRMED: "Paiement confirmé",
  ACCEPTED: "Acceptée",
  PREPARING: "En préparation",
  READY_FOR_PICKUP: "Prête pour l'enlèvement",
  PICKED_UP: "Récupérée par le livreur",
  IN_TRANSIT: "En livraison",
  DELIVERED_DECLARED: "Livraison déclarée",
  RECEIVED_CONFIRMED: "Réception confirmée par l'acheteur",
  CLOSED: "Terminée",
  CANCELLED: "Annulée",
  DISPUTED: "En litige",
  RETURN_REQUESTED: "Retour demandé",
  REFUNDED: "Remboursée",
};

const HUMEUR_PAR_STATUT: Record<string, "paye" | "attente" | "alerte" | "neutre"> = {
  CREATED: "attente",
  PAYMENT_PENDING: "attente",
  CANCELLED: "alerte",
  DISPUTED: "alerte",
  RETURN_REQUESTED: "alerte",
  REFUNDED: "alerte",
  RECEIVED_CONFIRMED: "paye",
  CLOSED: "paye",
};

function CommandesContent() {
  const { currentShop } = useShop();
  const [commandes, setCommandes] = useState<ShopOrder[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<ShopOrder[]>(`/shops/${currentShop.id}/orders`)
      .then(setCommandes)
      .catch((err) =>
        setErreur(
          err instanceof ApiError && err.statusCode === 403
            ? "Cette page est réservée à l'équipe qui gère les commandes de la boutique."
            : err instanceof Error
              ? err.message
              : "Erreur.",
        ),
      )
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function changerStatut(shopOrderId: string, cible: string) {
    setEnCours(shopOrderId);
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop!.id}/orders/${shopOrderId}/status`, { status: cible });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Changement de statut impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function imprimerBonLivraison(shopOrderId: string) {
    setErreur(null);
    try {
      const document = await api.post<{ id: string }>(
        `/shops/${currentShop!.id}/documents/shop-order/${shopOrderId}`,
        { type: "DELIVERY_NOTE" },
      );
      await ouvrirDocumentPdf(`/shops/${currentShop!.id}/documents/${document.id}/pdf`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de générer le document.");
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Commandes Marketplace</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {chargement ? (
        <p>Chargement…</p>
      ) : commandes.length === 0 ? (
        <p className={styles.messageVide}>Aucune commande venue de la Marketplace pour l&apos;instant.</p>
      ) : (
        commandes.map((so) => (
          <div className={styles.commande} key={so.id}>
            <div className={styles.entete}>
              <span>Commande #{so.order.id.slice(0, 8)}</span>
              <StatusTag
                label={LABELS_STATUT[so.status] ?? so.status}
                humeur={HUMEUR_PAR_STATUT[so.status] ?? "neutre"}
              />
            </div>
            <div className={styles.corps}>
              {so.lines.map((l) => (
                <div className={styles.ligne} key={l.id}>
                  <span>
                    {[l.variant.product.name, l.variant.size, l.variant.color].filter(Boolean).join(" — ")} ×{" "}
                    {l.quantity}
                  </span>
                  <span className="chiffre">{formatMoney(l.quantity * Number(l.unitPrice))}</span>
                </div>
              ))}
              <div className={styles.ligne} style={{ fontWeight: 600 }}>
                <span>Sous-total</span>
                <span className="chiffre">{formatMoney(Number(so.subtotal))}</span>
              </div>
            </div>
            <div className={styles.actions}>
              {(TRANSITIONS_STAFF[so.status] ?? []).map((t) => (
                <button
                  key={t.cible}
                  className={`${styles.boutonAction} ${t.annulation ? styles.boutonAnnuler : ""}`}
                  disabled={enCours === so.id}
                  onClick={() => changerStatut(so.id, t.cible)}
                >
                  {t.label}
                </button>
              ))}
              <button className={styles.boutonAction} onClick={() => imprimerBonLivraison(so.id)}>
                Imprimer le bon de livraison
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function CommandesPage() {
  return (
    <ProtectedGestionPage>
      <CommandesContent />
    </ProtectedGestionPage>
  );
}
