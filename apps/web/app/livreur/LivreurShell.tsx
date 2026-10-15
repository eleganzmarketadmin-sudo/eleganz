"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import styles from "./LivreurShell.module.css";

const LIENS = [
  { href: "/livreur/missions", label: "Mes missions" },
  { href: "/livreur/messagerie", label: "Messagerie" },
  { href: "/livreur/profil", label: "Mon profil" },
];

/**
 * Coquille de l'espace livreur (prompt §10) — même gabarit que GestionShell
 * et AdminShell (en-tête de marque, nav, pied de page), mais un espace
 * d'authentification à part (voir espaceAuth() dans api.ts) : un livreur et
 * un vendeur/acheteur ne doivent jamais partager la même session.
 */
export function LivreurShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/livreur/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;

  if (user.role !== "DRIVER") {
    return (
      <div className={styles.contenu}>
        <p>Ce compte n&apos;est pas un compte livreur ELEGANZ.</p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <span className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ <span>Livreur</span>
        </span>
        <div className={styles.enteteActions}>
          <AccueilLien />
          <NotificationBell />
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/livreur/connexion");
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
      <Footer variante="livreur" />
      <ChatWidget />
    </div>
  );
}
