"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { useCart } from "../../lib/cart-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

export default function CommandePage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
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
      setErreur(err instanceof ApiError ? err.message : t("cmd_erreurEnregistrement"));
    } finally {
      setEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  if (commandeConfirmee) {
    return (
      <div className={styles.cadre}>
        <div className={styles.confirmation}>
          <h1>{t("cmd_titreConfirmee")}</h1>
          <p>{t("cmd_texteConfirmee")}</p>
          <p style={{ marginTop: "24px" }}>
            <Link href="/marketplace/commandes">{t("cmd_suivreMesCommandes")}</Link>
          </p>
        </div>
      </div>
    );
  }

  if (lignes.length === 0) {
    return (
      <div className={styles.cadre}>
        <p>
          {t("panier_vide")} <Link href="/marketplace">{t("accueil_parcourirVitrine")}</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("cmd_titreConfirmer")}</h1>

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
          <span>{t("panier_total")}</span>
          <span className="chiffre">{formatMoney(total, devise)}</span>
        </div>
      </div>

      <p className={styles.note}>{t("cmd_notePaiement")}</p>

      <div className={styles.livraison}>
        <h2 className={styles.sousTitre}>{t("cmd_sousTitreLivraison")}</h2>
        <p className={styles.note} style={{ marginBottom: "var(--espace-3)" }}>
          {t("cmd_noteLivraison")}
        </p>
        <div className={styles.champs}>
          <label className={styles.champ}>
            <span>{t("cmd_labelWhatsapp")}</span>
            <input
              type="tel"
              placeholder={t("cmd_placeholderWhatsapp")}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </label>
          <label className={styles.champ}>
            <span>{t("cmd_labelTelephone")}</span>
            <input
              type="tel"
              placeholder={t("cmd_placeholderTelephone")}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </label>
          <label className={styles.champ}>
            <span>{t("cmd_labelCommune")}</span>
            <input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder={t("cmd_placeholderCommune")} />
          </label>
          <label className={styles.champ}>
            <span>{t("cmd_labelQuartier")}</span>
            <input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder={t("cmd_placeholderQuartier")} />
          </label>
          <label className={styles.champ}>
            <span>{t("cmd_labelAvenue")}</span>
            <input value={avenue} onChange={(e) => setAvenue(e.target.value)} placeholder={t("cmd_placeholderAvenue")} />
          </label>
          <label className={styles.champ}>
            <span>{t("cmd_labelRepere")}</span>
            <input value={repere} onChange={(e) => setRepere(e.target.value)} placeholder={t("cmd_placeholderRepere")} />
          </label>
        </div>
        <label className={styles.champ} style={{ marginTop: "var(--espace-3)" }}>
          <span>{t("cmd_labelNote")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("cmd_placeholderNote")}
          />
        </label>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <button className={styles.bouton} onClick={confirmer} disabled={enCours}>
        {enCours ? t("cmd_enregistrementEnCours") : t("cmd_confirmerCommande")}
      </button>
    </div>
  );
}
