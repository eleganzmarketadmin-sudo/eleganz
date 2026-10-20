import { formatMoney, pourcentageRemise } from "../lib/money";

/**
 * Affichage du prix avec étiquette de promotion (19 oct. 2026) — composant
 * partagé entre les trois surfaces marketplace qui montrent un prix (fiche
 * produit, page boutique, accueil marketplace), pour ne pas dupliquer la
 * règle d'affichage à trois endroits.
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
        }}
      >
        -{remise}%
      </span>
    </span>
  );
}
