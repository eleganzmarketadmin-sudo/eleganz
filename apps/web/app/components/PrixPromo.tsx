"use client";

import { formatMoney, pourcentageRemise } from "../lib/money";
import { useLocale } from "../lib/i18n/LocaleContext";

/**
 * Affichage du prix avec étiquette de promotion (19 oct. 2026) — composant
 * partagé entre les trois surfaces marketplace qui montrent un prix (fiche
 * produit, page boutique, accueil marketplace), pour ne pas dupliquer la
 * règle d'affichage à trois endroits.
 *
 * Mise à jour du 20 oct. 2026 (signalement : "dans marketplace ça affiche le
 * prix barré mais sans étiquette promo") : le badge affichait seulement un
 * pourcentage ("-13%"), facile à confondre avec une simple donnée de prix.
 * Il porte désormais le mot "PROMO" en toutes lettres pour être reconnu au
 * premier coup d'œil, même par un acheteur qui ne regarde pas le prix barré
 * en détail.
 */
export function PrixPromo({
  sellPrice,
  compareAtPrice,
  currency,
  taille = "normale",
}: {
  sellPrice: number;
  compareAtPrice?: number | string | null;
  currency: string;
  taille?: "normale" | "petite";
}) {
  const { t } = useLocale();
  const remise = pourcentageRemise(sellPrice, compareAtPrice);
  const tailleBadge = taille === "petite" ? "0.7rem" : "0.8rem";
  const tailleBarre = taille === "petite" ? "0.85rem" : "1rem";

  if (remise == null) {
    return <>{formatMoney(sellPrice, currency)}</>;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span>{formatMoney(sellPrice, currency)}</span>
      <span style={{ textDecoration: "line-through", opacity: 0.6, fontSize: tailleBarre }}>
        {formatMoney(Number(compareAtPrice), currency)}
      </span>
      <span
        style={{
          background: "var(--color-vert-paiement, #16a34a)",
          color: "#fff",
          borderRadius: "4px",
          padding: "2px 6px",
          fontSize: tailleBadge,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {t("market_promoLabel")} -{remise}%
      </span>
    </span>
  );
}

/**
 * Bandeau "PROMO -X%" posé sur l'image d'un produit (20 oct. 2026) — en plus
 * du badge inline à côté du prix (PrixPromo ci-dessus), pour que la
 * promotion soit visible même quand on ne regarde que la photo en
 * parcourant la liste, pas seulement le prix. À poser dans un conteneur en
 * `position: relative`.
 */
export function RubanPromo({
  sellPrice,
  compareAtPrice,
}: {
  sellPrice: number;
  compareAtPrice?: number | string | null;
}) {
  const { t } = useLocale();
  const remise = pourcentageRemise(sellPrice, compareAtPrice);
  if (remise == null) return null;

  return (
    <span
      style={{
        position: "absolute",
        top: "8px",
        left: "8px",
        background: "var(--color-vert-paiement, #16a34a)",
        color: "#fff",
        borderRadius: "4px",
        padding: "3px 8px",
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      {t("market_promoLabel")} -{remise}%
    </span>
  );
}
