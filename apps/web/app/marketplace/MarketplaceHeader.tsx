"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart-context";
import styles from "./MarketplaceHeader.module.css";

export function MarketplaceHeader() {
  const { lignes } = useCart();
  const { user, logout } = useAuth();
  const nombreArticles = lignes.reduce((s, l) => s + l.quantity, 0);

  return (
    <header className={styles.entete}>
      <Link href="/marketplace" className={styles.marque}>
        ELEGANZ
      </Link>
      <nav className={styles.liens}>
        <Link href="/marketplace/panier" className={styles.panier}>
          Panier
          {nombreArticles > 0 && <span className={styles.compteur}>{nombreArticles}</span>}
        </Link>
        {user ? (
          <>
            <Link href="/marketplace/commandes">Mes commandes</Link>
            <button
              onClick={logout}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <Link href="/marketplace/compte">Se connecter</Link>
        )}
      </nav>
    </header>
  );
}
