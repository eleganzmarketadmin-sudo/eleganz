"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, BandeMarque } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { ModulesMenu } from "./ModulesMenu";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useLocale } from "../lib/i18n/LocaleContext";
import { useVoletRepliable } from "../lib/useVoletRepliable";
import styles from "./SiteHeader.module.css";

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

  // Ordre demandé le 11 nov. 2026 : Gestion, Market, Mon assistant, puis
  // Trouver un expert en dernier — reflète l'ordre des cartes de la
  // section d'orientation de l'accueil (#outils, page.tsx).
  const LIENS = [
    { href: "/", label: t("nav_accueil") },
    { href: "/connexion", label: t("nom_gestion") },
    { href: "/marketplace", label: t("nom_market") },
    { href: "/comptable", label: t("titre_accueil") },
    { href: "/marketplace/experts", label: t("accueil_trouverUnExpert") },
    // FAQ publique (11 nov. 2026) — juste avant "À propos", à la suite des
    // quatre modules plutôt qu'au milieu d'eux (voir page.tsx pour l'ordre
    // demandé le 11 nov. 2026 pour les modules eux-mêmes, non concerné ici).
    { href: "/aide", label: t("nav_faq") },
    { href: "/a-propos", label: t("nav_aPropos") },
  ];

  // Repli du bloc actions + de la barre de nav sur téléphone (21 nov. 2026,
  // retour propriétaire — "étaler ces modifications à tous les modules" —
  // même mécanisme que GestionShell/AdminShell, voir leur commentaire
  // détaillé). Remplace l'ancien repli ad hoc (actions passant sur leur
  // propre ligne pleine largeur, sans jamais se replier) posé le 11 nov.
  // 2026. Sans effet ≥561px : .actions et .nav restent inchangés.
  const nav = useVoletRepliable(pathname);
  const options = useVoletRepliable(pathname);
  const lienActifMobile = LIENS.find((l) => pathname === l.href);
  const libelleNavMobile = lienActifMobile?.label ?? t("gshell_menu");

  return (
    <header className={styles.entete}>
      <div className={styles.contenu}>
        <ModulesMenu />
        <Link href="/" className={styles.marque}>
          <LogoMark size={28} />
          ELEGANZ
        </Link>
        <div className={styles.optionsBloc} ref={options.ref}>
          <button
            type="button"
            className={styles.boutonOptionsMobile}
            onClick={() => {
              options.basculer();
              nav.setOuvert(false);
            }}
            aria-expanded={options.ouvert}
            aria-controls="site-options"
            aria-label={t("gshell_options")}
            title={t("gshell_options")}
          >
            <span aria-hidden="true">⋮</span>
          </button>
          <div id="site-options" className={`${styles.actions} ${options.ouvert ? styles.actionsOuvert : ""}`}>
            <div className={styles.ligneChamp}>
              <span className={styles.etiquetteChamp}>{t("langue_label")}</span>
              <LanguageSwitcher />
            </div>
            <div className={styles.ligneChamp}>
              <span className={styles.etiquetteChamp}>{t("commun_devise")}</span>
              <CurrencySwitcher />
            </div>
            <ThemeToggle etiquette />
            {/* Signalement du 11 nov. 2026 : ce bouton menait tout droit à la
                connexion Gestion (/connexion), le seul des quatre modules —
                rien n'indiquait lequel on allait rejoindre. Renvoie maintenant
                vers la section d'orientation de l'accueil (#outils), qui pose
                la question dans les mots du visiteur pour chaque module avant
                de le laisser choisir où se connecter — jamais un module choisi
                à sa place. `/#outils` (chemin absolu) plutôt que `#outils` :
                ce bouton est aussi monté sur /a-propos, qui n'a pas cette
                section.
                `?portail=1` ajouté le 14 nov. 2026 (voir middleware.ts) : un
                visiteur déjà venu sur la Marketplace est maintenant redirigé
                vers elle dès "/", avant même le rendu du portail — sans ce
                paramètre, ce bouton le renverrait aussitôt vers la Marketplace
                au lieu du portail de choix de module qu'il vient justement de
                demander en cliquant ici. */}
            <Link href="/?portail=1#outils" className={styles.connexion} onClick={() => options.setOuvert(false)}>
              {t("action_seConnecter")}
            </Link>
          </div>
        </div>
      </div>
      <button
        type="button"
        className={styles.boutonNavMobile}
        onClick={() => {
          nav.basculer();
          options.setOuvert(false);
        }}
        aria-expanded={nav.ouvert}
        aria-controls="site-nav"
      >
        <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
          ☰
        </span>
        <span className={styles.boutonNavMobileLabel}>{libelleNavMobile}</span>
        <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
          {nav.ouvert ? "▴" : "▾"}
        </span>
      </button>
      <nav id="site-nav" className={`${styles.nav} ${nav.ouvert ? styles.navOuvert : ""}`} aria-label="Navigation principale">
        {LIENS.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${pathname === lien.href ? styles.navLienActif : ""}`}
            onClick={() => nav.setOuvert(false)}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <BandeMarque />
    </header>
  );
}
