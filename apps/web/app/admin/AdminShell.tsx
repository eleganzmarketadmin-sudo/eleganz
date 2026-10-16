"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./AdminShell.module.css";

// Menus accordés par rôle admin, par défaut (16 oct. 2026 — "le menu équipe
// ne donne pas toujours les menus pour une sélection d'attribution") :
// jusqu'ici TOUT compte ADMIN_* voyait et pouvait ouvrir l'intégralité du
// menu, quel que soit le rôle attribué depuis Équipe admin (Ventes,
// Finance, Opérations...) — seul `role.startsWith("ADMIN_")` était
// vérifié, aussi bien ici que dans chaque contrôleur admin côté API
// (requireAdmin()). Repris ici comme solution de secours avant que
// `/auth/me` ait répondu ; une fois répondu, `adminMenuItems` (calculé
// côté API, modifiable au cas par cas par un ADMIN_SUPER depuis Équipe
// admin) fait foi. Équipe admin et Paramètres plateforme restent réservés
// à ADMIN_SUPER par défaut.
const MENUS_PAR_ROLE_ADMIN: Record<string, string[]> = {
  ADMIN_SUPER: ["PILOTAGE", "BOUTIQUES", "LIVREURS", "COMPTABLE", "FINANCE", "SUIVI_COMMANDES", "UTILISATEURS", "TARIFS", "FACTURES", "RELEVES", "LITIGES", "EXPERTS", "MESSAGERIE", "EQUIPE_ADMIN", "PARAMETRES_PLATEFORME"],
  ADMIN_SALES: ["PILOTAGE", "BOUTIQUES", "SUIVI_COMMANDES", "TARIFS", "LITIGES"],
  ADMIN_FINANCE: ["PILOTAGE", "FINANCE", "FACTURES", "TARIFS", "RELEVES"],
  ADMIN_OPS: ["PILOTAGE", "SUIVI_COMMANDES", "LITIGES", "RELEVES", "BOUTIQUES"],
  ADMIN_LOGISTICS: ["PILOTAGE", "LIVREURS", "SUIVI_COMMANDES"],
  ADMIN_MARKETING: ["PILOTAGE", "BOUTIQUES", "MESSAGERIE"],
  ADMIN_SUPPORT: ["PILOTAGE", "UTILISATEURS", "LITIGES", "MESSAGERIE", "SUIVI_COMMANDES", "EXPERTS"],
  ADMIN_AUDITOR: ["PILOTAGE", "FINANCE", "FACTURES", "RELEVES"],
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  // `menu` = la clé MenuAdmin (API) correspondant à chaque lien — sert au
  // filtrage ci-dessous.
  const LIENS = [
    { href: "/admin/pilotage", label: t("nav_tableauDeBord"), menu: "PILOTAGE" },
    { href: "/admin/boutiques", label: t("nav_boutiques"), menu: "BOUTIQUES" },
    { href: "/admin/livreurs", label: t("nav_livreurs"), menu: "LIVREURS" },
    { href: "/admin/comptable", label: t("titre_accueil"), menu: "COMPTABLE" },
    { href: "/admin/finance", label: t("nav_finance"), menu: "FINANCE" },
    { href: "/admin/suivi-commandes", label: t("nav_suiviCommandes"), menu: "SUIVI_COMMANDES" },
    { href: "/admin/utilisateurs", label: t("nav_utilisateurs"), menu: "UTILISATEURS" },
    { href: "/admin/tarifs", label: t("nav_tarifs"), menu: "TARIFS" },
    { href: "/admin/factures", label: t("nav_factures"), menu: "FACTURES" },
    { href: "/admin/releves", label: t("nav_releves"), menu: "RELEVES" },
    { href: "/admin/litiges", label: t("nav_litiges"), menu: "LITIGES" },
    { href: "/admin/experts", label: t("nav_experts"), menu: "EXPERTS" },
    { href: "/admin/messagerie", label: t("nav_messagerie"), menu: "MESSAGERIE" },
    { href: "/admin/equipe", label: t("nav_equipeAdmin"), menu: "EQUIPE_ADMIN" },
    { href: "/admin/parametres", label: t("nav_parametresPlateforme"), menu: "PARAMETRES_PLATEFORME" },
  ];

  // `adminMenuItems` (GET /auth/me, calculé côté API — voir
  // AdminTeamService/menu-admin.util.ts) prime dès qu'il est disponible sur
  // la table de secours par rôle ci-dessus.
  const [menuItems, setMenuItems] = useState<string[] | null>(null);
  useEffect(() => {
    if (!user?.role?.startsWith("ADMIN_")) return;
    api
      .get<{ adminMenuItems?: string[] }>("/auth/me")
      .then((moi) => setMenuItems(moi.adminMenuItems ?? null))
      .catch(() => setMenuItems(null));
  }, [user?.id]);

  const ecransAutorises = menuItems ?? (user?.role ? MENUS_PAR_ROLE_ADMIN[user.role] : undefined) ?? LIENS.map((l) => l.menu);
  const liens = LIENS.filter((l) => ecransAutorises.includes(l.menu));

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;

  if (!user.role.startsWith("ADMIN_")) {
    return (
      <div className={styles.contenu}>
        <p>Ce compte n&apos;a pas accès au Centre de pilotage ELEGANZ.</p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <span className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ <span>Centre de pilotage</span>
        </span>
        <div className={styles.enteteActions}>
          <AccueilLien />
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            {t("action_seDeconnecter")}
          </button>
        </div>
      </header>
      <BandeMarque />
      <nav className={styles.nav}>
        {liens.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${
              pathname === lien.href || pathname?.startsWith(`${lien.href}/`) ? styles.navLienActif : ""
            }`}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="admin" />
      <ChatWidget />
    </div>
  );
}
