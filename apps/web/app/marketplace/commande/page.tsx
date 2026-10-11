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

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <button className={styles.bouton} onClick={confirmer} disabled={enCours}>
        {enCours ? "Enregistrement…" : "Confirmer la commande"}
      </button>
    </div>
  );
}
