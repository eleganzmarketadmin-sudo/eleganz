"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import styles from "./ComptableShell.module.css";

const LIENS = [
  { href: "/comptable", label: "Accueil" },
  { href: "/comptable/activites", label: "Mes activités" },
  { href: "/comptable/chiffres", label: "Mon activité en chiffres" },
  { href: "/comptable/agenda", label: "Agenda" },
  { href: "/comptable/abonnement", label: "Abonnement" },
];

/**
 * Coquille d'ELEGANZ Mon Comptable (prompt du 13 oct. 2026, §3) — espace
 * fonctionnellement autonome (pas de boutique requise), mais partage le
 * compte ELEGANZ commun : contrairement à l'espace livreur ou admin, aucune
 * clé de jeton séparée, aucun rôle imposé — n'importe quel compte ELEGANZ
 * authentifié peut utiliser Mon Comptable (voir espaceAuth() dans api.ts,
 * qui range tout ce qui n'est pas /admin ou /livreur dans le même espace
 * "défaut" que la Marketplace et Gestion).
 */
export function ComptableShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/marketplace/compte?retour=/comptable");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <span className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ <span>Mon Comptable</span>
        </span>
        <div className={styles.enteteActions}>
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/marketplace/compte");
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>
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
