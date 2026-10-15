"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart-context";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { NotificationBell } from "../components/NotificationBell";
import { AccueilLien } from "../components/AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./MarketplaceHeader.module.css";

export function MarketplaceHeader() {
  const { lignes } = useCart();
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const nombreArticles = lignes.reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <header className={styles.entete}>
        <Link href="/marketplace" className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ <span className={styles.nomModule}>{t("nom_market")}</span>
        </Link>
        <nav className={styles.liens}>
          <AccueilLien />
          <LanguageSwitcher />
          <ThemeToggle clair />
          <Link href="/marketplace/panier" className={styles.panier}>
            {t("nav_panier")}
            {nombreArticles > 0 && <span className={styles.compteur}>{nombreArticles}</span>}
          </Link>
          {user ? (
            <>
              <NotificationBell />
              <Link href="/marketplace/commandes">{t("nav_mesCommandes")}</Link>
              <Link href="/marketplace/messagerie">{t("nav_messagerie")}</Link>
              <button
                onClick={logout}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                {t("action_seDeconnecter")}
              </button>
            </>
          ) : (
            <Link href="/marketplace/compte">{t("action_seConnecter")}</Link>
          )}
        </nav>
      </header>
      <BandeMarque />
    </>
  );
}
