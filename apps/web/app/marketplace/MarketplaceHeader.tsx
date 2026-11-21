"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart-context";
import { ThemeToggle } from "../components/ThemeToggle";
import { CurrencySwitcher } from "../components/CurrencySwitcher";
import { LogoMark, BandeMarque } from "../components/Logo";
import { NotificationBell } from "../components/NotificationBell";
import { AccueilLien } from "../components/AccueilLien";
import { ModulesMenu } from "../components/ModulesMenu";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useClampDropdownADroite } from "../lib/useClampDropdown";
import { useVoletRepliable } from "../lib/useVoletRepliable";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClampDropdownADroite(dropdownRef, ouvert);

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
        aria-label={t("market_monCompte")}
      >
        <span aria-hidden="true">👤</span>
        {/* 10 nov. 2026 : texte masqué en très petit écran pour que le
            bouton tienne sur la même ligne (voir .texteBouton, utilisé
            uniquement hors volet options). 21 nov. 2026 : classe distincte
            (.menuCompteTexte) depuis que ce bouton vit aussi dans le volet
            "options" repliable, en pleine largeur — là, le texte doit
            rester visible quelle que soit la largeur d'écran. */}
        <span className={styles.menuCompteTexte}>{t("market_monCompte")}</span>
        <span aria-hidden="true">{ouvert ? "▲" : "▼"}</span>
      </button>
      {ouvert && (
        <div className={styles.menuCompteDropdown} role="menu" ref={dropdownRef}>
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
  const pathname = usePathname();
  // 10 nov. 2026 : affichait la SOMME des quantités (1 article × 1 + 1
  // article × 4 = "5"), ce qui ne correspond à rien de concret pour le
  // client — il voit "5" alors qu'il n'a que 2 articles différents dans son
  // panier. Le badge compte désormais le nombre de lignes (d'articles
  // distincts), pas les quantités commandées de chacun.
  const nombreArticles = lignes.length;

  // Repli du volet "options" (préférences + compte) et du volet nav
  // (Boutiques/Experts) sur téléphone (21 nov. 2026, retour propriétaire —
  // "étaler ces modifications à tous les modules", même mécanisme que
  // GestionShell/AdminShell). Adaptation sur mesure, pas un simple portage
  // mécanique : ici nav et options partagent aujourd'hui une seule rangée
  // `.liens` sur desktop — elle reste strictement inchangée ≥561px (l'ordre
  // visuel de chaque élément est fixé par `order` en CSS, indépendamment de
  // leur regroupement DOM ci-dessous) et ne se scinde qu'en-dessous. Le
  // panier reste toujours visible, jamais derrière un volet replié (action
  // commerciale principale) — ni le logo/ModulesMenu, déjà toujours visibles
  // par construction.
  const nav = useVoletRepliable(pathname);
  const options = useVoletRepliable(pathname);
  // 21 nov. 2026, retour propriétaire : relais du compteur de notifications
  // non lues sur le bouton "⋮" (voir le commentaire détaillé dans
  // AdminShell.tsx, même mécanisme à l'identique).
  const [notifNonLues, setNotifNonLues] = useState(0);

  return (
    // Enveloppe sticky (retour client du 12 nov. 2026 : "l'en-tête doit
    // rester figée pendant la navigation et le défilement") — l'en-tête de
    // la Marketplace était jusqu'ici le seul des deux en-têtes publics
    // (contrairement à SiteHeader) à défiler avec le reste de la page.
    // Englobe aussi le bandeau de couleur (BandeMarque) pour qu'il reste
    // collé juste sous l'en-tête plutôt que de défiler séparément.
    <div className={styles.enveloppeFixe}>
      <header className={styles.entete}>
        <div className={styles.groupeMarque}>
          <ModulesMenu />
          <Link href="/marketplace" className={styles.marque}>
            <LogoMark size={28} />
            ELEGANZ <span className={styles.nomModule}>{t("nom_market")}</span>
          </Link>
        </div>
        <nav className={styles.liens}>
          {/* Liens principaux — rangée inchangée sur desktop (`display:
              contents`), masqués en-dessous de 560px : doublés (liens
              simples, sans état) dans la barre de nav mobile séparée
              ci-dessous, avec son propre bouton de repli. */}
          <div className={styles.grpNavPrincipal}>
            <AccueilLien />
            <Link href="/marketplace/boutiques">{t("market_boutiques")}</Link>
            <Link href="/marketplace/experts">{t("accueil_trouverUnExpert")}</Link>
          </div>

          {/* Volet "options" (préférences + compte) — rangée inchangée sur
              desktop (`display: contents`, deux sous-groupes pour que
              `order` CSS puisse intercaler le panier exactement à sa place
              d'origine), devient le popover "⋮" en-dessous de 560px.
              `options.ref` englobe ici À LA FOIS le déclencheur et le
              popover (comme `.optionsBloc` dans les autres coquilles) :
              sans ça, cliquer sur le bouton "⋮" lui-même serait vu comme un
              clic "en dehors" par le hook, qui refermerait le volet au même
              instant que le bouton l'ouvre. */}
          <div ref={options.ref} className={styles.ancreOptions}>
            <div
              id="market-options"
              className={`${styles.optionsGroupe} ${options.ouvert ? styles.optionsGroupeOuvert : ""}`}
            >
              <div className={styles.grpOptionsA}>
                <div className={styles.ligneChamp}>
                  <span className={styles.etiquetteChamp}>{t("langue_label")}</span>
                  <LanguageSwitcher />
                </div>
                <div className={styles.ligneChamp}>
                  <span className={styles.etiquetteChamp}>{t("commun_devise")}</span>
                  <CurrencySwitcher />
                </div>
                <ThemeToggle clair etiquette />
              </div>
              <div className={styles.grpOptionsB}>
                {user ? (
                  <>
                    <NotificationBell etiquette onNonLuesChange={setNotifNonLues} />
                    <MenuCompte />
                  </>
                ) : (
                  <Link href="/marketplace/compte" className={styles.connexionEtiquette} onClick={() => options.setOuvert(false)}>
                    {t("action_seConnecter")}
                  </Link>
                )}
              </div>
            </div>

            <button
              type="button"
              className={styles.boutonOptionsMobile}
              onClick={() => {
                options.basculer();
                nav.setOuvert(false);
              }}
              aria-expanded={options.ouvert}
              aria-controls="market-options"
              aria-label={t("gshell_options")}
              title={t("gshell_options")}
            >
              <span aria-hidden="true">⋮</span>
              {notifNonLues > 0 && (
                <span className={styles.badgeOptionsMobile}>{notifNonLues > 9 ? "9+" : notifNonLues}</span>
              )}
            </button>
          </div>

          {/* Panier — toujours visible, même replié (action commerciale
              principale), jamais dans un volet. */}
          <Link href="/marketplace/panier" className={styles.panier} aria-label={t("nav_panier")}>
            <span aria-hidden="true">🛒</span>
            <span className={styles.texteBouton}>{t("nav_panier")}</span>
            {nombreArticles > 0 && <span className={styles.compteur}>{nombreArticles}</span>}
          </Link>
        </nav>
      </header>
      <BandeMarque couleur="var(--color-magenta-sur-fonce)" />
      {/* Bouton de repli de la barre de nav mobile — pas de `ref` sur le
          volet nav lui-même (même convention que les autres coquilles,
          voir AdminShell/ComptableShell : seul le volet "options" ferme au
          clic en dehors ; la nav se referme en navigant ou au changement de
          page, via l'effet du hook). */}
      <button
        type="button"
        className={styles.boutonNavMobile}
        onClick={() => {
          nav.basculer();
          options.setOuvert(false);
        }}
        aria-expanded={nav.ouvert}
        aria-controls="market-nav-mobile"
      >
        <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
          ☰
        </span>
        <span className={styles.boutonNavMobileLabel}>{t("gshell_menu")}</span>
        <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
          {nav.ouvert ? "▴" : "▾"}
        </span>
      </button>
      <nav
        id="market-nav-mobile"
        className={`${styles.navMobile} ${nav.ouvert ? styles.navMobileOuvert : ""}`}
      >
        <AccueilLien etiquette />
        <Link href="/marketplace/boutiques" className={styles.navMobileLien} onClick={() => nav.setOuvert(false)}>
          {t("market_boutiques")}
        </Link>
        <Link href="/marketplace/experts" className={styles.navMobileLien} onClick={() => nav.setOuvert(false)}>
          {t("accueil_trouverUnExpert")}
        </Link>
      </nav>
    </div>
  );
}
