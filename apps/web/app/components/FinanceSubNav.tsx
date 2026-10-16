"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "../lib/shop-context";
import { useLocale } from "../lib/i18n/LocaleContext";

// Sous-navigation du menu "Finance & Comptabilité" (prompt du 13 oct. 2026) —
// un seul lien dans la nav principale de GestionShell (déjà chargée en
// liens, défilement horizontal), les rubriques du menu Finance vivent ici.
//
// Mode Gestionnaire / Mode Comptable (14 oct. 2026, chantier SYSCOHADA phase
// 5, cahier des charges §6) — purement un REGROUPEMENT D'AFFICHAGE : chaque
// onglet reste accessible dans les deux modes (un clic sur "Tout afficher"
// révèle l'autre groupe), et le contrôle d'accès réel reste entièrement côté
// API (ShopMembershipGuard/@ShopRoles/@RequiresGestionFeature) — ce
// composant ne bloque jamais une route, il ne fait que réduire le bruit
// visuel selon le rôle probable de la personne. Préférence mémorisée par
// navigateur (localStorage), jamais envoyée au serveur.
const GESTION_COURANTE = [
  { href: "/finance", label: "Tableau de bord" },
  { href: "/finance/charges", label: "Charges" },
  { href: "/finance/creances-dettes", label: "Créances & dettes" },
  { href: "/finance/tresorerie", label: "Trésorerie" },
  { href: "/finance/stock", label: "Stock & CMV" },
];

const COMPTABILITE_SYSCOHADA = [
  { href: "/finance/comptabilite", label: "Comptabilité" },
  { href: "/finance/immobilisations", label: "Immobilisations" },
  { href: "/finance/cloture", label: "Clôture" },
  { href: "/finance/analytique", label: "Analytique" },
  { href: "/finance/regles-fiscales", label: "Règles fiscales" },
  { href: "/finance/simulation-fiscale", label: "Simulation fiscale" },
];

const STORAGE_KEY = "eleganz_finance_mode";
type Mode = "GESTIONNAIRE" | "COMPTABLE" | "TOUT";

function modeParDefaut(role: string | null | undefined): Mode {
  // Un comptable (interne ou externe invité) voit directement le registre
  // complet par défaut ; tout autre rôle part sur la vue allégée — mais rien
  // n'empêche de basculer, voir le bouton "Tout afficher" ci-dessous.
  return role === "ACCOUNTANT" || role === "EXTERNAL_ACCOUNTANT" ? "COMPTABLE" : "GESTIONNAIRE";
}

export function FinanceSubNav() {
  const pathname = usePathname();
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("GESTIONNAIRE");
  const [initialise, setInitialise] = useState(false);

  useEffect(() => {
    try {
      const enregistre = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
      setMode(enregistre ?? modeParDefaut(currentShop?.myRole));
    } catch {
      setMode(modeParDefaut(currentShop?.myRole));
    } finally {
      setInitialise(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id]);

  function changerMode(m: Mode) {
    setMode(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignoré — simple confort de navigation
    }
  }

  // Avant la première lecture de localStorage, afficher tout plutôt que de
  // risquer de cacher l'onglet actif pendant un instant.
  const onglets = !initialise
    ? [...GESTION_COURANTE, ...COMPTABILITE_SYSCOHADA]
    : mode === "GESTIONNAIRE"
      ? GESTION_COURANTE
      : mode === "COMPTABLE"
        ? COMPTABILITE_SYSCOHADA
        : [...GESTION_COURANTE, ...COMPTABILITE_SYSCOHADA];

  // Raccourci "inviter un comptable externe" (demande du 16 oct. 2026, point
  // 6) — le rôle EXTERNAL_ACCOUNTANT existe déjà côté invitation d'équipe
  // (/equipe), mais rien dans Finance n'en parlait jusqu'ici : masqué pour
  // l'externe lui-même (qui n'inviterait pas son propre remplaçant) et pour
  // le staff sans droit d'invitation (seuls OWNER/MANAGER invitent, voir
  // shops.controller.ts).
  const peutInviter = currentShop?.myRole === "OWNER" || currentShop?.myRole === "MANAGER";

  return (
    <div style={{ marginBottom: "24px" }}>
      {peutInviter && (
        <p style={{ fontSize: "0.8125rem", marginBottom: "10px" }}>
          <Link href="/equipe" style={{ textDecoration: "underline" }}>
            {t("fin_inviterComptableExterne")}
          </Link>
        </p>
      )}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", fontSize: "0.8rem" }}>
        <button
          onClick={() => changerMode("GESTIONNAIRE")}
          style={{ fontWeight: mode === "GESTIONNAIRE" ? 700 : 400 }}
        >
          Mode Gestionnaire
        </button>
        <button onClick={() => changerMode("COMPTABLE")} style={{ fontWeight: mode === "COMPTABLE" ? 700 : 400 }}>
          Mode Comptable
        </button>
        <button onClick={() => changerMode("TOUT")} style={{ fontWeight: mode === "TOUT" ? 700 : 400 }}>
          Tout afficher
        </button>
      </div>
      <nav
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid var(--color-bordure, #333)",
          flexWrap: "wrap",
        }}
      >
        {onglets.map((o) => (
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
    </div>
  );
}
