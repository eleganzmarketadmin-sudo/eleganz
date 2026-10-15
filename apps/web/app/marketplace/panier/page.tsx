"use client";

import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

export default function PanierPage() {
  const { t } = useLocale();
  const { lignes, modifierQuantite, retirer, total, devise } = useCart();

  if (lignes.length === 0) {
    return (
      <div className={styles.cadre}>
        <h1 className={styles.titre}>{t("nav_panier")}</h1>
        <p className={styles.messageVide}>
          {t("panier_vide")} <Link href="/marketplace">{t("accueil_parcourirVitrine")}</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("nav_panier")}</h1>

      {lignes.map((l) => (
        <div className={styles.ligne} key={l.variantId}>
          <div className={styles.nom}>
            {l.productName}
            {(l.size || l.color) && ` — ${[l.size, l.color].filter(Boolean).join(" · ")}`}
            <div className={styles.boutique}>{l.shopName}</div>
          </div>
          <input
            className={styles.qte}
            type="number"
            min={1}
            max={l.stockDisponible}
            value={l.quantity}
            onChange={(e) => modifierQuantite(l.variantId, Number(e.target.value))}
          />
          <span className={styles.montant}>{formatMoney(l.quantity * l.unitPrice, l.currency)}</span>
          <button className={styles.retirer} onClick={() => retirer(l.variantId)}>
            ✕
          </button>
        </div>
      ))}

      <div className={styles.total}>
        <span>{t("panier_total")}</span>
        <span className="chiffre">{formatMoney(total, devise)}</span>
      </div>

      <Link href="/marketplace/commande" className={styles.bouton} style={{ display: "block", textAlign: "center", lineHeight: "var(--touche-min)", textDecoration: "none" }}>
        {t("panier_passerCommande")}
      </Link>
    </div>
  );
}
