"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { getToken } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
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
    { href: "/livreur/messagerie", label: t("nav_messagerie") },
    { href: "/livreur/profil", label: t("livr_monProfil") },
  ];

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
          <span className={styles.marque}>
            <LogoMark size={28} />
            ELEGANZ <span>{t("livr_titre")}</span>
          </span>
          <div className={styles.enteteActions}>
            <AccueilLien />
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle clair />
            <button
              className={styles.deconnexion}
              onClick={() => {
                logout();
                router.push("/");
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
        <nav className={styles.nav} ref={navRef}>
          {LIENS.map((lien) => {
            const actif = pathname === lien.href;
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={`${styles.navLien} ${actif ? styles.navLienActif : ""}`}
                data-nav-actif={actif ? "true" : undefined}
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
