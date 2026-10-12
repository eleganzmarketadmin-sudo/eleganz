"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { useCart } from "../../lib/cart-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

export default function CommandePage() {
  const { user, loading: authLoading } = useAuth();
  const { lignes, total, devise, vider } = useCart();
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [commandeConfirmee, setCommandeConfirmee] = useState(false);

  // Coordonnées de livraison — la boutique en a besoin pour joindre
  // l'acheteur et organiser la livraison (aucun paiement en ligne ni
  // adresse GPS n'existe encore à ce stade). WhatsApp en priorité : c'est
  // le canal de contact le plus utilisé à Kinshasa.
  const [whatsapp, setWhatsapp] = useState("");
  const [telephone, setTelephone] = useState("");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [avenue, setAvenue] = useState("");
  const [repere, setRepere] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/marketplace/compte?retour=/marketplace/commande");
    }
  }, [authLoading, user, router]);

  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/marketplace/orders", {
        items: lignes.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        buyerWhatsapp: whatsapp.trim() || undefined,
        buyerPhone: telephone.trim() || undefined,
        deliveryCommune: commune.trim() || undefined,
        deliveryQuartier: quartier.trim() || undefined,
        deliveryAvenue: avenue.trim() || undefined,
        deliveryRepere: repere.trim() || undefined,
        deliveryNote: note.trim() || undefined,
      });
      vider();
      setCommandeConfirmee(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "La commande n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  if (commandeConfirmee) {
    return (
      <div className={styles.cadre}>
        <div className={styles.confirmation}>
          <h1>Commande enregistrée</h1>
          <p>Chaque boutique concernée va la préparer. Vous réglez à la livraison, en espèces ou en mobile money.</p>
          <p style={{ marginTop: "24px" }}>
            <Link href="/marketplace/commandes">Suivre mes commandes</Link>
          </p>
        </div>
      </div>
    );
  }

  if (lignes.length === 0) {
    return (
      <div className={styles.cadre}>
        <p>Votre panier est vide. <Link href="/marketplace">Parcourir la vitrine</Link>.</p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>Confirmer la commande</h1>

      <div className={styles.recap}>
        {lignes.map((l) => (
          <div className={styles.ligne} key={l.variantId}>
            <span>
              {l.productName} × {l.quantity}
            </span>
            <span className="chiffre">{formatMoney(l.quantity * l.unitPrice, l.currency)}</span>
          </div>
        ))}
        <div className={styles.total}>
          <span>Total</span>
          <span className="chiffre">{formatMoney(total, devise)}</span>
        </div>
      </div>

      <p className={styles.note}>
        Paiement à la livraison pour l&apos;instant (espèces ou mobile money) — le paiement en
        ligne arrive prochainement. Si votre commande vient de plusieurs boutiques, chacune la
        prépare séparément.
      </p>

      <div className={styles.livraison}>
        <h2 className={styles.sousTitre}>Pour vous contacter et livrer la commande</h2>
        <p className={styles.note} style={{ marginBottom: "var(--espace-3)" }}>
          La boutique s&apos;en sert pour vous joindre et organiser la livraison. Donnez au moins
          un numéro.
        </p>
        <div className={styles.champs}>
          <label className={styles.champ}>
            <span>Numéro WhatsApp (de préférence)</span>
            <input
              type="tel"
              placeholder="Ex. 081 234 5678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </label>
          <label className={styles.champ}>
            <span>Autre numéro de téléphone</span>
            <input
              type="tel"
              placeholder="Si différent du WhatsApp"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </label>
          <label className={styles.champ}>
            <span>Commune</span>
            <input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Ex. Gombe" />
          </label>
          <label className={styles.champ}>
            <span>Quartier</span>
            <input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Ex. Socimat" />
          </label>
          <label className={styles.champ}>
            <span>Avenue</span>
            <input value={avenue} onChange={(e) => setAvenue(e.target.value)} placeholder="Ex. Avenue du Commerce" />
          </label>
          <label className={styles.champ}>
            <span>Point de repère</span>
            <input value={repere} onChange={(e) => setRepere(e.target.value)} placeholder="Ex. Près de la pharmacie" />
          </label>
        </div>
        <label className={styles.champ} style={{ marginTop: "var(--espace-3)" }}>
          <span>Note pour le livreur (optionnel)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ex. Appeler avant de monter, disponible après 17h…"
          />
        </label>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <button className={styles.bouton} onClick={confirmer} disabled={enCours}>
        {enCours ? "Enregistrement…" : "Confirmer la commande"}
      </button>
    </div>
  );
}
