"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import styles from "./page.module.css";

interface OrderLine {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  variant: { size: string | null; color: string | null; product: { name: string } };
}

// Livreur propre à la boutique (13 oct. 2026, 1ʳᵉ demande du jour) — en
// remplacement du réseau de livreurs plateforme (fermé au grand public) :
// une fiche gérée par la boutique elle-même, sous sa propre responsabilité,
// voir (gestion)/livreurs/page.tsx.
interface Livreur {
  id: string;
  fullName: string;
  phone: string | null;
  vehicleType: string | null;
  active: boolean;
}

interface ShopOrder {
  id: string;
  status: string;
  subtotal: string;
  createdAt: string;
  lines: OrderLine[];
  shopDriver: { id: string; fullName: string; phone: string | null } | null;
  order: {
    id: string;
    createdAt: string;
    buyer?: { fullName: string; phone: string | null };
    buyerWhatsapp?: string | null;
    buyerPhone?: string | null;
    deliveryCommune?: string | null;
    deliveryQuartier?: string | null;
    deliveryAvenue?: string | null;
    deliveryRepere?: string | null;
    deliveryNote?: string | null;
  };
}

/** Garde uniquement les chiffres (et le préfixe +) pour construire un lien wa.me. */
function versLienWhatsapp(numero: string): string {
  const chiffres = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${chiffres}`;
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
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [litigeOuvertPour, setLitigeOuvertPour] = useState<string | null>(null);
  const [motifLitige, setMotifLitige] = useState("");
  const [exportEnCours, setExportEnCours] = useState(false);
  const [selectionLivreur, setSelectionLivreur] = useState<Record<string, string>>({});

  async function exporter() {
    if (!currentShop) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      await telechargerFichier(`/shops/${currentShop.id}/orders/export`, "mes-commandes-eleganz.xlsx");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Export impossible.");
    } finally {
      setExportEnCours(false);
    }
  }

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

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<Livreur[]>(`/shops/${currentShop.id}/drivers`)
      .then((tous) => setLivreurs(tous.filter((l) => l.active)))
      .catch(() => {
        // Non bloquant : la liste des livreurs n'existe que pour le
        // sélecteur d'affectation, son indisponibilité ne doit pas empêcher
        // de consulter ou traiter les commandes.
      });
  }, [currentShop]);

  async function affecterLivreur(shopOrderId: string) {
    const shopDriverId = selectionLivreur[shopOrderId];
    if (!shopDriverId) return;
    setEnCours(shopOrderId);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop!.id}/orders/${shopOrderId}/driver`, { shopDriverId });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Affectation impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function retirerLivreur(shopOrderId: string) {
    setEnCours(shopOrderId);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop!.id}/orders/${shopOrderId}/driver`, { shopDriverId: null });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Retrait impossible.");
    } finally {
      setEnCours(null);
    }
  }

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

  async function signalerLitige(shopOrderId: string) {
    if (!motifLitige.trim()) return;
    setEnCours(shopOrderId);
    setErreur(null);
    try {
      await api.post(`/shops/${currentShop!.id}/orders/${shopOrderId}/dispute`, { reason: motifLitige.trim() });
      setLitigeOuvertPour(null);
      setMotifLitige("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible d'ouvrir le litige.");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <h1 className={styles.titre}>Commandes Marketplace</h1>
        <button className={styles.boutonAction} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? "…" : "Exporter en Excel"}
        </button>
      </div>
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
            {(so.order.buyerWhatsapp ||
              so.order.buyerPhone ||
              so.order.deliveryCommune ||
              so.order.deliveryQuartier ||
              so.order.deliveryAvenue ||
              so.order.deliveryRepere ||
              so.order.deliveryNote) && (
              <div className={styles.contact}>
                <div className={styles.contactLigne}>
                  <strong>{so.order.buyer?.fullName ?? "Acheteur"}</strong>
                  {so.order.buyerWhatsapp && (
                    <a
                      className={styles.lienWhatsapp}
                      href={versLienWhatsapp(so.order.buyerWhatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp : {so.order.buyerWhatsapp}
                    </a>
                  )}
                  {so.order.buyerPhone && <span>Tél. {so.order.buyerPhone}</span>}
                </div>
                {(so.order.deliveryCommune || so.order.deliveryQuartier || so.order.deliveryAvenue || so.order.deliveryRepere) && (
                  <div className={styles.contactAdresse}>
                    Livraison :{" "}
                    {[so.order.deliveryAvenue, so.order.deliveryQuartier, so.order.deliveryCommune]
                      .filter(Boolean)
                      .join(", ")}
                    {so.order.deliveryRepere ? ` — repère : ${so.order.deliveryRepere}` : ""}
                  </div>
                )}
                {so.order.deliveryNote && <div className={styles.contactAdresse}>Note : {so.order.deliveryNote}</div>}
              </div>
            )}
            {!["CLOSED", "CANCELLED", "REFUNDED"].includes(so.status) && (
              <div className={styles.contact}>
                <div className={styles.contactLigne}>
                  <strong>Livreur</strong>
                  <span>
                    {so.shopDriver
                      ? so.shopDriver.fullName
                      : "Pas encore affecté"}
                  </span>
                </div>
                <div className={styles.contactLigne}>
                  <select
                    value={selectionLivreur[so.id] ?? ""}
                    disabled={enCours === so.id}
                    onChange={(e) =>
                      setSelectionLivreur((v) => ({ ...v, [so.id]: e.target.value }))
                    }
                  >
                    <option value="">
                      {livreurs.length === 0 ? "Aucun livreur enregistré — voir Livreurs" : "Choisir un livreur…"}
                    </option>
                    {livreurs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.fullName}
                        {l.phone ? ` — ${l.phone}` : ""}
                        {l.vehicleType ? ` (${l.vehicleType})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.boutonAction}
                    disabled={enCours === so.id || !selectionLivreur[so.id]}
                    onClick={() => affecterLivreur(so.id)}
                  >
                    {so.shopDriver ? "Changer de livreur" : "Affecter"}
                  </button>
                  {so.shopDriver && (
                    <button
                      className={`${styles.boutonAction} ${styles.boutonAnnuler}`}
                      disabled={enCours === so.id}
                      onClick={() => retirerLivreur(so.id)}
                    >
                      Retirer l&apos;affectation
                    </button>
                  )}
                </div>
              </div>
            )}
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
              {!["DISPUTED", "CANCELLED", "REFUNDED", "CLOSED"].includes(so.status) && (
                <button
                  className={`${styles.boutonAction} ${styles.boutonAnnuler}`}
                  onClick={() => {
                    setLitigeOuvertPour(so.id);
                    setMotifLitige("");
                  }}
                >
                  Signaler un litige
                </button>
              )}
            </div>
            {litigeOuvertPour === so.id && (
              <div className={styles.corps}>
                <textarea
                  className={styles.motifLitige}
                  placeholder="Expliquez le problème (ex. acheteur introuvable à la livraison, colis refusé sans motif...)"
                  value={motifLitige}
                  onChange={(e) => setMotifLitige(e.target.value)}
                  rows={3}
                />
                <div className={styles.actions} style={{ padding: 0, border: "none" }}>
                  <button
                    className={styles.boutonAction}
                    disabled={enCours === so.id || !motifLitige.trim()}
                    onClick={() => signalerLitige(so.id)}
                  >
                    Envoyer à l&apos;administration
                  </button>
                  <button
                    className={styles.boutonAction}
                    onClick={() => {
                      setLitigeOuvertPour(null);
                      setMotifLitige("");
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
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
