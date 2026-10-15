"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./AdminShell.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  const LIENS = [
    { href: "/admin/pilotage", label: t("nav_tableauDeBord") },
    { href: "/admin/boutiques", label: t("nav_boutiques") },
    { href: "/admin/livreurs", label: t("nav_livreurs") },
    { href: "/admin/comptable", label: t("titre_accueil") },
    { href: "/admin/finance", label: t("nav_finance") },
    { href: "/admin/suivi-commandes", label: t("nav_suiviCommandes") },
    { href: "/admin/utilisateurs", label: t("nav_utilisateurs") },
    { href: "/admin/tarifs", label: t("nav_tarifs") },
    { href: "/admin/factures", label: t("nav_factures") },
    { href: "/admin/releves", label: t("nav_releves") },
    { href: "/admin/litiges", label: t("nav_litiges") },
    { href: "/admin/equipe", label: t("nav_equipeAdmin") },
    { href: "/admin/parametres", label: t("nav_parametresPlateforme") },
  ];

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
          <LanguageSwitcher />
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/admin/connexion");
            }}
          >
            {t("action_seDeconnecter")}
          </button>
        </div>
      </header>
      <BandeMarque />
      <nav className={styles.nav}>
        {LIENS.map((lien) => (
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
    </div>
  );
}
