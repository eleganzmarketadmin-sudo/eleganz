"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import styles from "./AdminShell.module.css";

const LIENS = [
  { href: "/admin/pilotage", label: "Tableau de bord" },
  { href: "/admin/boutiques", label: "Boutiques" },
  { href: "/admin/tarifs", label: "Tarifs" },
  { href: "/admin/litiges", label: "Litiges" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
          ELEGANZ <span>Centre de pilotage</span>
        </span>
        <button
          className={styles.deconnexion}
          onClick={() => {
            logout();
            router.push("/admin/connexion");
          }}
        >
          Se déconnecter
        </button>
      </header>
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
      <main className={styles.contenu}>{children}</main>
    </div>
  );
}
