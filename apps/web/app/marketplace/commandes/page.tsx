"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/money";
import { StatusTag } from "../../components/StatusTag";
import { useLocale } from "../../lib/i18n/LocaleContext";
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
  driver: { user: { fullName: string } } | null;
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

const CLES_STATUT: Record<string, string> = {
  CREATED: "statut_creee",
  PAYMENT_PENDING: "statut_paiementAttente",
  PAYMENT_CONFIRMED: "statut_paiementConfirme",
  ACCEPTED: "statut_accepteeBoutique",
  PREPARING: "statut_enPreparation",
  READY_FOR_PICKUP: "statut_preteEnlevement",
  PICKED_UP: "statut_recupereeLivreur",
  IN_TRANSIT: "statut_enLivraison",
  DELIVERED_DECLARED: "statut_livraisonDeclaree",
  RECEIVED_CONFIRMED: "statut_receptionConfirmee",
  CLOSED: "statut_terminee",
  CANCELLED: "statut_annulee",
  DISPUTED: "statut_enLitige",
  RETURN_REQUESTED: "statut_retourDemande",
  REFUNDED: "statut_remboursee",
};

export default function CommandesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [user]);

  async function confirmerReception(shopOrderId: string) {
    setEnCours(shopOrderId);
    try {
      await api.post(`/marketplace/orders/${shopOrderId}/confirm-receipt`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_confirmationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  // Annulation côté acheteur (demande du 16 oct. 2026, point 4) — n'est
  // proposée que tant que la boutique n'a pas commencé la préparation, les
  // mêmes statuts que le bouton d'annulation déjà existant côté Gestion
  // (voir ALLOWED_TRANSITIONS dans orders.service.ts).
  async function annulerCommande(shopOrderId: string) {
    if (!window.confirm(t("cmd_confirmerAnnulation"))) return;
    setEnCours(shopOrderId);
    try {
      await api.post(`/marketplace/orders/${shopOrderId}/cancel`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cmd_annulationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  const STATUTS_ANNULABLES = ["CREATED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ACCEPTED"];

  function ouvrirAvis(so: ShopOrder) {
    setAvisPour(so);
    setNoteAvis(0);
    setCommentaireAvis("");
    setErreur(null);
  }

  async function envoyerAvis() {
    if (!avisPour || !noteAvis) {
      setErreur(t("avis_choisirNoteErreur"));
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
      setErreur(err instanceof ApiError ? err.message : t("cmd_avisEchec"));
    } finally {
      setEnvoiAvisEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("nav_mesCommandes")}</h1>

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : erreur ? (
        <p>{erreur}</p>
      ) : commandes.length === 0 ? (
        <p className={styles.messageVide}>
          {t("cmd_aucuneCommande")} <Link href="/marketplace">{t("accueil_parcourirVitrine")}</Link>.
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
                <span>
                  {so.lines.length} {t("cmd_articleSuffix")}
                  {so.driver && (
                    <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--color-texte-muted)" }}>
                      {t("cmd_confieA").replace("{{nom}}", so.driver.user.fullName)}
                    </span>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <StatusTag
                    label={CLES_STATUT[so.status] ? t(CLES_STATUT[so.status]) : so.status}
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
                      {t("cmd_confirmerReception")}
                    </button>
                  )}
                  {STATUTS_ANNULABLES.includes(so.status) && (
                    <button
                      disabled={enCours === so.id}
                      onClick={() => annulerCommande(so.id)}
                      style={{
                        border: "2px solid var(--color-flamme)",
                        color: "var(--color-flamme)",
                        background: "none",
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {t("cmd_annulerCommande")}
                    </button>
                  )}
                  {["RECEIVED_CONFIRMED", "CLOSED"].includes(so.status) &&
                    (avisEnvoyesPour.has(so.id) ? (
                      <span style={{ color: "var(--color-vert-paiement)", fontSize: "0.8125rem" }}>{t("cmd_avisEnvoye")}</span>
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
                        {t("avis_laisserAvis")}
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
            <h2 style={{ marginBottom: "12px" }}>{t("cmd_votreAvis")}</h2>
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
                  aria-label={`${n} ${t("avis_etoileLabel")}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              placeholder={t("cmd_placeholderExperience")}
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
                {envoiAvisEnCours ? t("avis_envoiEnCours") : t("avis_publier")}
              </button>
              <button
                onClick={() => setAvisPour(null)}
                style={{ background: "none", border: "none", color: "var(--color-texte-muted)", cursor: "pointer" }}
              >
                {t("action_annuler")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
