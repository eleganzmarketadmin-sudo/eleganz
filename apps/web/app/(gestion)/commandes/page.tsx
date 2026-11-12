"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { ouvrirDocumentPdf, construireUrlPdfPublique } from "../../lib/pdf";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { useLocale } from "../../lib/i18n/LocaleContext";
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
    // Intention de paiement annoncée par l'acheteur (10 nov. 2026, point 4) —
    // juste informatif (voir OrdersService.createOrder), pour que la
    // boutique sache à quoi s'attendre à la remise de la commande.
    payments?: { method: string; confirmed: boolean }[];
  };
}

/** Garde uniquement les chiffres (et le préfixe +) pour construire un lien wa.me. */
function versLienWhatsapp(numero: string): string {
  const chiffres = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${chiffres}`;
}

/**
 * Variante avec un message pré-rempli (paramètre `text` du lien wa.me) —
 * utilisée pour le partage de facture (12 nov. 2026).
 */
function versLienWhatsappAvecMessage(numero: string, message: string): string {
  const chiffres = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}

// Reflet côté écran de ALLOWED_TRANSITIONS (orders.service.ts) — seulement
// les transitions qu'un membre de l'équipe déclenche lui-même ; la
// confirmation de réception reste un geste de l'acheteur. Circuit adapté au
// paiement au moment de la commande (mobile money).
const TRANSITIONS_STAFF: Record<string, { cible: string; cle: string; annulation?: boolean }[]> = {
  CREATED: [
    { cible: "PAYMENT_PENDING", cle: "gcmd_marquerPaiementAttente" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  PAYMENT_PENDING: [
    { cible: "PAYMENT_CONFIRMED", cle: "gcmd_confirmerPaiement" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  PAYMENT_CONFIRMED: [
    { cible: "ACCEPTED", cle: "gcmd_accepterCommande" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  ACCEPTED: [
    { cible: "PREPARING", cle: "gcmd_commencerPreparation" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  PREPARING: [{ cible: "READY_FOR_PICKUP", cle: "statut_preteEnlevement" }],
  READY_FOR_PICKUP: [{ cible: "PICKED_UP", cle: "statut_recupereeLivreur" }],
  PICKED_UP: [{ cible: "IN_TRANSIT", cle: "statut_enLivraison" }],
  IN_TRANSIT: [{ cible: "DELIVERED_DECLARED", cle: "gcmd_declarerLivraison" }],
};

// Second circuit (reflet de ALLOWED_TRANSITIONS_PAIEMENT_LIVRAISON,
// orders.service.ts, 10 nov. 2026 point 2) — pour les commandes payées en
// espèces à la livraison : rien à confirmer avant que le livreur ait
// effectivement remis l'argent, donc la boutique accepte et prépare
// directement, et la confirmation de paiement est demandée une fois la
// commande en route, juste avant de déclarer la livraison.
const TRANSITIONS_STAFF_PAIEMENT_LIVRAISON: Record<string, { cible: string; cle: string; annulation?: boolean }[]> = {
  CREATED: [
    { cible: "ACCEPTED", cle: "gcmd_accepterCommande" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  ACCEPTED: [
    { cible: "PREPARING", cle: "gcmd_commencerPreparation" },
    { cible: "CANCELLED", cle: "action_annuler", annulation: true },
  ],
  PREPARING: [{ cible: "READY_FOR_PICKUP", cle: "statut_preteEnlevement" }],
  READY_FOR_PICKUP: [{ cible: "PICKED_UP", cle: "statut_recupereeLivreur" }],
  PICKED_UP: [{ cible: "IN_TRANSIT", cle: "statut_enLivraison" }],
  IN_TRANSIT: [{ cible: "PAYMENT_CONFIRMED", cle: "gcmd_confirmerPaiementLivraison" }],
  PAYMENT_CONFIRMED: [{ cible: "DELIVERED_DECLARED", cle: "gcmd_declarerLivraison" }],
};

/** Choisit le circuit de transitions à afficher selon le mode de paiement
 * annoncé par l'acheteur à la commande — même logique que circuitSuivi()
 * côté API (orders.service.ts), jamais recalculée indépendamment. */
function transitionsPour(so: ShopOrder): { cible: string; cle: string; annulation?: boolean }[] {
  const circuit =
    so.order.payments?.[0]?.method === "CASH_ON_DELIVERY"
      ? TRANSITIONS_STAFF_PAIEMENT_LIVRAISON
      : TRANSITIONS_STAFF;
  return circuit[so.status] ?? [];
}

const CLES_STATUT: Record<string, string> = {
  CREATED: "statut_creee",
  PAYMENT_PENDING: "statut_paiementAttente",
  PAYMENT_CONFIRMED: "statut_paiementConfirme",
  ACCEPTED: "gcmd_statutAcceptee",
  PREPARING: "statut_enPreparation",
  READY_FOR_PICKUP: "statut_preteEnlevement",
  PICKED_UP: "statut_recupereeLivreur",
  IN_TRANSIT: "statut_enLivraison",
  DELIVERED_DECLARED: "statut_livraisonDeclaree",
  RECEIVED_CONFIRMED: "gcmd_statutReceptionConfirmeeAcheteur",
  CLOSED: "statut_terminee",
  CANCELLED: "statut_annulee",
  DISPUTED: "statut_enLitige",
  RETURN_REQUESTED: "statut_retourDemande",
  REFUNDED: "statut_remboursee",
};

const HUMEUR_PAR_STATUT: Record<string, "paye" | "attente" | "alerte" | "neutre"> = {
  CREATED: "attente",
  PAYMENT_PENDING: "attente",
  CANCELLED: "alerte",
  DISPUTED: "alerte",
  RETURN_REQUESTED: "alerte",
  REFUNDED: "alerte",
  PAYMENT_CONFIRMED: "paye",
  RECEIVED_CONFIRMED: "paye",
  CLOSED: "paye",
};

function CommandesContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
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
      setErreur(err instanceof ApiError ? err.message : t("fact_exportImpossible"));
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
            ? t("gcmd_reserveEquipe")
            : err instanceof Error
              ? err.message
              : t("cmd_erreurGenerique"),
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
      setErreur(err instanceof ApiError ? err.message : t("gcmd_affectationImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("gcmd_retraitImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function changerStatut(shopOrderId: string, cible: string) {
    // Code de livraison (18 oct. 2026, audit "preuve de livraison
    // simulée/placeholder") : exigé côté API uniquement pour cette
    // transition précise — voir OrdersService.transitionStatus. On le
    // demande ici au moment de l'action plutôt que d'ajouter un champ
    // permanent au formulaire, qui ne servirait que sur cette seule
    // transition parmi toutes celles de TRANSITIONS_STAFF.
    let deliveryCode: string | undefined;
    if (cible === "DELIVERED_DECLARED") {
      const saisie = window.prompt(t("gcmd_demanderCodeLivraison"));
      if (saisie === null) return;
      deliveryCode = saisie.trim();
    }
    setEnCours(shopOrderId);
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop!.id}/orders/${shopOrderId}/status`, { status: cible, deliveryCode });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gcmd_changementStatutImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("gcmd_ouvertureLitigeImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("gcmd_generationDocumentImpossible"));
    }
  }

  /**
   * Partage la facture par WhatsApp (12 nov. 2026, demande : "donner la
   * possibilité à la boutique de partager la facture après paiement
   * effectif via whatsapp automatiquement au numéro whatsapp renseigné par
   * le client"). Option choisie par l'utilisateur : bouton "Partager" en 1
   * clic, gratuit — génère la facture, ouvre WhatsApp pré-adressé au client
   * avec un lien de consultation, l'envoi final reste un geste manuel de la
   * boutique (pas d'automatisation complète, qui exigerait un compte
   * WhatsApp Business API payant que l'utilisateur devrait créer lui-même).
   *
   * La fenêtre WhatsApp est ouverte de façon SYNCHRONE au clic (même
   * raisonnement que ouvrirDocumentPdf dans lib/pdf.ts) pour ne pas être
   * bloquée par les bloqueurs de popup des navigateurs mobiles, puis
   * redirigée vers le lien wa.me une fois la facture générée.
   */
  async function partagerFactureWhatsapp(so: ShopOrder) {
    if (!so.order.buyerWhatsapp) return;
    let fenetre: Window | null = null;
    try {
      fenetre = window.open("", "_blank");
    } catch {
      fenetre = null;
    }
    setEnCours(so.id);
    setErreur(null);
    try {
      const document = await api.post<{ id: string }>(
        `/shops/${currentShop!.id}/documents/shop-order/${so.id}`,
        { type: "INVOICE_INTERNAL" },
      );
      const lienFacture = construireUrlPdfPublique(document.id);
      const nomClient = so.order.buyer?.fullName ?? t("gcmd_acheteurFallback");
      const message = t("gcmd_messageWhatsappFacture")
        .replace("{{client}}", nomClient)
        .replace("{{boutique}}", currentShop!.name)
        .replace("{{lien}}", lienFacture);
      const lienWhatsapp = versLienWhatsappAvecMessage(so.order.buyerWhatsapp, message);
      if (fenetre && !fenetre.closed) {
        fenetre.location.href = lienWhatsapp;
      } else {
        window.open(lienWhatsapp, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      fenetre?.close();
      setErreur(err instanceof ApiError ? err.message : t("gcmd_generationDocumentImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <h1 className={styles.titre}>{t("gcmd_titre")}</h1>
        <button className={styles.boutonAction} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? "…" : t("fact_exporterExcel")}
        </button>
      </div>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : commandes.length === 0 ? (
        <p className={styles.messageVide}>{t("gcmd_aucuneCommande")}</p>
      ) : (
        commandes.map((so) => (
          <div className={styles.commande} key={so.id}>
            <div className={styles.entete}>
              <span>{t("lit_commandeNum").replace("{{id}}", so.order.id.slice(0, 8))}</span>
              <StatusTag
                label={CLES_STATUT[so.status] ? t(CLES_STATUT[so.status]) : so.status}
                humeur={HUMEUR_PAR_STATUT[so.status] ?? "neutre"}
              />
            </div>
            {(so.order.buyerWhatsapp ||
              so.order.buyerPhone ||
              so.order.deliveryCommune ||
              so.order.deliveryQuartier ||
              so.order.deliveryAvenue ||
              so.order.deliveryRepere ||
              so.order.deliveryNote ||
              so.order.payments?.[0]) && (
              <div className={styles.contact}>
                <div className={styles.contactLigne}>
                  <strong>{so.order.buyer?.fullName ?? t("gcmd_acheteurFallback")}</strong>
                  {so.order.buyerWhatsapp && (
                    <a
                      className={styles.lienWhatsapp}
                      href={versLienWhatsapp(so.order.buyerWhatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("gcmd_whatsappPrefix")} {so.order.buyerWhatsapp}
                    </a>
                  )}
                  {so.order.buyerPhone && <span>{t("gcmd_telPrefix")} {so.order.buyerPhone}</span>}
                </div>
                {(so.order.deliveryCommune || so.order.deliveryQuartier || so.order.deliveryAvenue || so.order.deliveryRepere) && (
                  <div className={styles.contactAdresse}>
                    {t("gcmd_livraisonPrefix")}{" "}
                    {[so.order.deliveryAvenue, so.order.deliveryQuartier, so.order.deliveryCommune]
                      .filter(Boolean)
                      .join(", ")}
                    {so.order.deliveryRepere ? ` — ${t("gcmd_reperePrefix")} ${so.order.deliveryRepere}` : ""}
                  </div>
                )}
                {so.order.deliveryNote && (
                  <div className={styles.contactAdresse}>
                    {t("gcmd_notePrefix")} {so.order.deliveryNote}
                  </div>
                )}
                {so.order.payments?.[0] && (
                  <div className={styles.contactAdresse}>
                    {t("gcmd_paiementPrefix")}{" "}
                    {so.order.payments[0].method === "MOBILE_MONEY"
                      ? t("cmd_modePaiementMobileMoney")
                      : t("cmd_modePaiementCash")}
                  </div>
                )}
              </div>
            )}
            {!["CLOSED", "CANCELLED", "REFUNDED"].includes(so.status) && (
              <div className={styles.contact}>
                <div className={styles.contactLigne}>
                  <strong>{t("gcmd_livreurLabel")}</strong>
                  <span>{so.shopDriver ? so.shopDriver.fullName : t("gcmd_pasAffecte")}</span>
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
                      {livreurs.length === 0 ? t("gcmd_aucunLivreurVoirLivreurs") : t("gcmd_choisirLivreur")}
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
                    {so.shopDriver ? t("gcmd_changerLivreur") : t("gcmd_affecter")}
                  </button>
                  {so.shopDriver && (
                    <button
                      className={`${styles.boutonAction} ${styles.boutonAnnuler}`}
                      disabled={enCours === so.id}
                      onClick={() => retirerLivreur(so.id)}
                    >
                      {t("gcmd_retirerAffectation")}
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
                <span>{t("gcmd_sousTotal")}</span>
                <span className="chiffre">{formatMoney(Number(so.subtotal))}</span>
              </div>
            </div>
            <div className={styles.actions}>
              {transitionsPour(so).map((transition) => (
                <button
                  key={transition.cible}
                  className={`${styles.boutonAction} ${transition.annulation ? styles.boutonAnnuler : ""}`}
                  disabled={enCours === so.id}
                  onClick={() => changerStatut(so.id, transition.cible)}
                >
                  {t(transition.cle)}
                </button>
              ))}
              <button className={styles.boutonAction} onClick={() => imprimerBonLivraison(so.id)}>
                {t("gcmd_imprimerBonLivraison")}
              </button>
              {HUMEUR_PAR_STATUT[so.status] === "paye" && so.order.buyerWhatsapp && (
                <button
                  className={styles.boutonAction}
                  disabled={enCours === so.id}
                  onClick={() => partagerFactureWhatsapp(so)}
                >
                  {t("gcmd_partagerFactureWhatsapp")}
                </button>
              )}
              {!["DISPUTED", "CANCELLED", "REFUNDED", "CLOSED"].includes(so.status) && (
                <button
                  className={`${styles.boutonAction} ${styles.boutonAnnuler}`}
                  onClick={() => {
                    setLitigeOuvertPour(so.id);
                    setMotifLitige("");
                  }}
                >
                  {t("gcmd_signalerLitige")}
                </button>
              )}
            </div>
            {litigeOuvertPour === so.id && (
              <div className={styles.corps}>
                <textarea
                  className={styles.motifLitige}
                  placeholder={t("gcmd_placeholderMotifLitige")}
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
                    {t("gcmd_envoyerAdministration")}
                  </button>
                  <button
                    className={styles.boutonAction}
                    onClick={() => {
                      setLitigeOuvertPour(null);
                      setMotifLitige("");
                    }}
                  >
                    {t("action_annuler")}
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
