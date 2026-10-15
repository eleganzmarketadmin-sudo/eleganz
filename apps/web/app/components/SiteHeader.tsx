"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, BandeMarque } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./SiteHeader.module.css";

const LIENS = [
  { href: "/", label: "Accueil" },
  { href: "/connexion", label: "Gestion" },
  { href: "/marketplace", label: "Market" },
  { href: "/comptable", label: "Mon Comptable" },
  { href: "/a-propos", label: "À propos" },
];

/**
 * Barre de navigation des pages publiques (accueil, à propos) — demande UX
 * du 15 oct. 2026, point 1 : "il n'y a même pas de barre de menu". N'est
 * montée que sur ces pages de vitrine, jamais dans les espaces applicatifs
 * (Gestion/Admin/Comptable/Livreur/Marketplace ont chacun leur propre
 * en-tête avec leur propre jeton — voir *Shell.tsx et MarketplaceHeader.tsx)
 * pour ne pas dupliquer la navigation ni semer la confusion sur quel compte
 * est actif.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <header className={styles.entete}>
      <div className={styles.contenu}>
        <Link href="/" className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ
        </Link>
        <div className={styles.actions}>
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/connexion" className={styles.connexion}>
            {t("action_seConnecter")}
          </Link>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Navigation principale">
        {LIENS.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${pathname === lien.href ? styles.navLienActif : ""}`}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <BandeMarque />
    </header>
  );
}
