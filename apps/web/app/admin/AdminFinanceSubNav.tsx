"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "../lib/i18n/LocaleContext";

// Sous-navigation du menu "Finance & Comptabilité" du Centre de pilotage
// (demande du 16 oct. 2026, point 2 : "LE Dossier crédit n'est pas dans le
// menu finances et compta du centre de pilotage") — jusqu'ici chaque
// sous-page (comptabilité, règles fiscales) n'avait qu'un simple lien de
// retour vers le tableau de bord, rien ne regroupait les rubriques entre
// elles comme FinanceSubNav le fait côté boutique.
const ONGLETS = [
  { href: "/admin/finance", cle: "admfinnav_tableauBord" },
  { href: "/admin/finance/comptabilite", cle: "admfinnav_comptabilite" },
  { href: "/admin/finance/dossier-credit", cle: "admfinnav_dossierCredit" },
  { href: "/admin/finance/rapport-annuel", cle: "admfinnav_rapportAnnuel" },
  { href: "/admin/finance/regles-fiscales", cle: "admfinnav_reglesFiscales" },
  // Ajout du 18 oct. 2026 (audit du 18 oct. 2026, point 2) — jusqu'ici
  // ELEGANZ n'avait aucun moyen d'estimer sa propre charge fiscale, alors
  // que l'outil existait déjà côté boutique (FinanceSubNav).
  { href: "/admin/finance/simulation-fiscale", cle: "admfinnav_simulationFiscale" },
];

export function AdminFinanceSubNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav
      style={{
        display: "flex",
        gap: "4px",
        borderBottom: "1px solid var(--color-bordure, #333)",
        flexWrap: "wrap",
        marginBottom: "20px",
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
          {t(o.cle)}
        </Link>
      ))}
    </nav>
  );
}
