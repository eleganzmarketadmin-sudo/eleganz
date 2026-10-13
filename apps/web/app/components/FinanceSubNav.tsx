"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sous-navigation du menu "Finance & Comptabilité" (prompt du 13 oct. 2026) —
// un seul lien dans la nav principale de GestionShell (déjà chargée en
// liens, défilement horizontal), les rubriques du menu Finance vivent ici.
const ONGLETS = [
  { href: "/finance", label: "Tableau de bord" },
  { href: "/finance/charges", label: "Charges" },
  { href: "/finance/regles-fiscales", label: "Règles fiscales" },
  { href: "/finance/simulation-fiscale", label: "Simulation fiscale" },
  { href: "/finance/comptabilite", label: "Comptabilité" },
  { href: "/finance/immobilisations", label: "Immobilisations" },
  { href: "/finance/cloture", label: "Clôture" },
];

export function FinanceSubNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        display: "flex",
        gap: "4px",
        marginBottom: "24px",
        borderBottom: "1px solid var(--color-bordure, #333)",
        flexWrap: "wrap",
      }}
    >
      {ONGLETS.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          style={{
            padding: "8px 14px",
            fontWeight: pathname === o.href ? 700 : 500,
            borderBottom: pathname === o.href ? "2px solid var(--color-vert-paiement)" : "2px solid transparent",
            color: "inherit",
          }}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
