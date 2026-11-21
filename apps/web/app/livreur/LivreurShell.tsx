"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { getToken } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { CurrencySwitcher } from "../components/CurrencySwitcher";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { ModulesMenu } from "../components/ModulesMenu";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import { useVoletRepliable } from "../lib/useVoletRepliable";
import styles from "./LivreurShell.module.css";

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
  const { t, reviewRecommended } = useLocale();
  const navRef = useRef<HTMLElement>(null);
  useScrollNavActifEnVue(navRef, pathname ?? "");

  const LIENS = [
    { href: "/livreur/missions", label: t("livr_mesMissions") },
    { href: "/livreur/demandes", label: t("livDem_titreNav") },
    { href: "/livreur/messagerie", label: t("nav_messagerie") },
    { href: "/livreur/profil", label: t("livr_monProfil") },
  ];

  // Repli de la barre d'onglets et du bloc options sur téléphone (21 nov.
  // 2026, retour propriétaire — "étaler ces modifications à tous les
  // modules", voir le commentaire détaillé dans GestionShell.tsx).
  const nav = useVoletRepliable(pathname);
  const options = useVoletRepliable(pathname);
  const lienActifMobile = LIENS.find((l) => pathname === l.href);
  const libelleNavMobile = lienActifMobile?.label ?? t("gshell_menu");

  // Voir le commentaire détaillé dans AdminShell.tsx (13 nov. 2026) : on
  // revérifie le jeton stocké avant de rediriger, pour ne pas renvoyer à
  // tort vers la connexion un utilisateur fraîchement authentifié pendant
  // le court instant où le contexte React n'a pas encore répercuté `user`.
  useEffect(() => {
    if (!loading && !user && !getToken()) router.replace("/livreur/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;

  if (user.role !== "DRIVER") {
    return (
      <div className={styles.contenu}>
        <p>{t("livr_compteNonLivreur")}</p>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      {/* Enveloppe sticky (retour client du 12 nov. 2026 : "la fixation des
          en-têtes dans la plateforme lors du défilement ou navigation n'est
          toujours pas effective") — voir aussi GestionShell/AdminShell. */}
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          {/* Volet "passerelle entre modules" (demande du 13 nov. 2026 :
              "ajouter les 3 barres/volet vertical à tous les modules") —
              voir le commentaire détaillé dans AdminShell.tsx. */}
          <div className={styles.groupeMarque}>
            <ModulesMenu />
            <span className={styles.marque}>
              <LogoMark size={28} />
              ELEGANZ <span>{t("livr_titre")}</span>
            </span>
          </div>
          <div className={styles.optionsBloc} ref={options.ref}>
            <button
              type="button"
              className={styles.boutonOptionsMobile}
              onClick={() => {
                options.basculer();
                nav.setOuvert(false);
              }}
              aria-expanded={options.ouvert}
              aria-controls="livreur-options"
              aria-label={t("gshell_options")}
              title={t("gshell_options")}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            <div id="livreur-options" className={`${styles.enteteActions} ${options.ouvert ? styles.enteteActionsOuvert : ""}`}>
              <AccueilLien etiquette />
              <NotificationBell etiquette />
              <div className={styles.separateurOptions} />
              <div className={styles.groupePreferences}>
                <span className={styles.titreSection}>{t("gshell_preferences")}</span>
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
              <div className={styles.separateurOptions} />
              <button
                className={styles.deconnexion}
                onClick={() => {
                  options.setOuvert(false);
                  logout();
                  router.push("/");
                }}
              >
                {t("action_seDeconnecter")}
              </button>
            </div>
          </div>
        </header>
        {reviewRecommended && (
          <p className={styles.bandeauRevue}>{t("langue_reviewNotice")}</p>
        )}
        <BandeMarque couleur="var(--color-flamme-sur-fonce)" />
        <button
          type="button"
          className={styles.boutonNavMobile}
          onClick={() => {
            nav.basculer();
            options.setOuvert(false);
          }}
          aria-expanded={nav.ouvert}
          aria-controls="livreur-nav"
        >
          <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
            ☰
          </span>
          <span className={styles.boutonNavMobileLabel}>{libelleNavMobile}</span>
          <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
            {nav.ouvert ? "▴" : "▾"}
          </span>
        </button>
        <nav id="livreur-nav" className={`${styles.nav} ${nav.ouvert ? styles.navOuvert : ""}`} ref={navRef}>
          {LIENS.map((lien) => {
            const actif = pathname === lien.href;
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={`${styles.navLien} ${actif ? styles.navLienActif : ""}`}
                data-nav-actif={actif ? "true" : undefined}
                onClick={() => nav.setOuvert(false)}
              >
                {lien.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="livreur" />
      <ChatWidget />
    </div>
  );
}
