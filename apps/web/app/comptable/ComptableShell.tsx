"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { LocaleProvider, useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./ComptableShell.module.css";

/**
 * Coquille d'ELEGANZ Mon Comptable (prompt du 13 oct. 2026, §3) — espace
 * fonctionnellement autonome (pas de boutique requise), mais partage le
 * compte ELEGANZ commun : contrairement à l'espace livreur ou admin, aucune
 * clé de jeton séparée, aucun rôle imposé — n'importe quel compte ELEGANZ
 * authentifié peut utiliser Mon Comptable (voir espaceAuth() dans api.ts,
 * qui range tout ce qui n'est pas /admin ou /livreur dans le même espace
 * "défaut" que la Marketplace et Gestion).
 *
 * Enveloppé dans LocaleProvider (prompt §21 + réponse du 13 oct. 2026) :
 * choix de langue pour les menus/titres/boutons, mémorisé par navigateur.
 */
export function ComptableShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ComptableShellInterieur>{children}</ComptableShellInterieur>
    </LocaleProvider>
  );
}

function ComptableShellInterieur({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t, reviewRecommended } = useLocale();

  useEffect(() => {
    if (!loading && !user) router.replace("/marketplace/compte?retour=/comptable");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const LIENS = [
    { href: "/comptable", label: t("nav_accueil") },
    { href: "/comptable/activites", label: t("nav_mesActivites") },
    { href: "/comptable/chiffres", label: t("nav_chiffres") },
    { href: "/comptable/agenda", label: t("nav_agenda") },
    { href: "/comptable/abonnement", label: t("nav_abonnement") },
  ];

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <span className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ <span>{t("titre_accueil")}</span>
        </span>
        <div className={styles.enteteActions}>
          <LanguageSwitcher />
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/marketplace/compte");
            }}
          >
            {t("action_seDeconnecter")}
          </button>
        </div>
      </header>
      {reviewRecommended && (
        <p className={styles.bandeauRevue}>{t("langue_reviewNotice")}</p>
      )}
      <BandeMarque />
      <nav className={styles.nav}>
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
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="comptable" />
    </div>
  );
}
