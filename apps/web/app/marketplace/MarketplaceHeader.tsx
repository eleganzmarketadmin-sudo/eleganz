"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart-context";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { NotificationBell } from "../components/NotificationBell";
import { AccueilLien } from "../components/AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./MarketplaceHeader.module.css";

/**
 * Menu "Mon compte" (prompt du 15 oct. 2026, point 2) — regroupe mon
 * profil, mes adresses, mes commandes et la messagerie derrière un seul
 * menu déroulant, comme sur les grandes plateformes de vente en ligne,
 * au lieu d'étaler ces liens à plat dans le header.
 */
function MenuCompte() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLocale();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  return (
    <div className={styles.menuCompte} ref={ref}>
      <button
        type="button"
        className={styles.menuCompteBouton}
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
      >
        {t("market_monCompte")} {ouvert ? "▲" : "▼"}
      </button>
      {ouvert && (
        <div className={styles.menuCompteDropdown} role="menu">
          <Link href="/marketplace/profil" onClick={() => setOuvert(false)}>
            {t("market_monProfil")}
          </Link>
          <Link href="/marketplace/profil#adresses" onClick={() => setOuvert(false)}>
            {t("market_mesAdresses")}
          </Link>
          <Link href="/marketplace/commandes" onClick={() => setOuvert(false)}>
            {t("nav_mesCommandes")}
          </Link>
          <Link href="/marketplace/messagerie" onClick={() => setOuvert(false)}>
            {t("nav_messagerie")}
          </Link>
          <Link href="/marketplace/experts/moi" onClick={() => setOuvert(false)}>
            {t("experts_monProfilLien")}
          </Link>
          <button
            type="button"
            className={styles.menuCompteDeconnexion}
            onClick={() => {
              setOuvert(false);
              logout();
              router.push("/");
            }}
          >
            {t("action_seDeconnecter")}
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketplaceHeader() {
  const { lignes } = useCart();
  const { user } = useAuth();
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
          <Link href="/marketplace/boutiques">{t("market_boutiques")}</Link>
          <Link href="/marketplace/experts">{t("accueil_trouverUnExpert")}</Link>
          <LanguageSwitcher />
          <ThemeToggle clair />
          <Link href="/marketplace/panier" className={styles.panier}>
            {t("nav_panier")}
            {nombreArticles > 0 && <span className={styles.compteur}>{nombreArticles}</span>}
          </Link>
          {user ? (
            <>
              <NotificationBell />
              <MenuCompte />
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
