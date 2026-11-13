"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { api, getToken } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { ModulesMenu } from "../components/ModulesMenu";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import styles from "./AdminShell.module.css";

// Menus accordés par rôle admin, par défaut (16 oct. 2026 — "le menu équipe
// ne donne pas toujours les menus pour une sélection d'attribution") :
// jusqu'ici TOUT compte ADMIN_* voyait et pouvait ouvrir l'intégralité du
// menu, quel que soit le rôle attribué depuis Équipe admin (Ventes,
// Finance, Opérations...) — seul `role.startsWith("ADMIN_")` était
// vérifié, aussi bien ici que dans chaque contrôleur admin côté API
// (requireAdmin()). Repris ici comme solution de secours avant que
// `/auth/me` ait répondu ; une fois répondu, `adminMenuItems` (calculé
// côté API, modifiable au cas par cas par un ADMIN_SUPER depuis Équipe
// admin) fait foi. Équipe admin et Paramètres plateforme restent réservés
// à ADMIN_SUPER par défaut.
const MENUS_PAR_ROLE_ADMIN: Record<string, string[]> = {
  ADMIN_SUPER: ["PILOTAGE", "BOUTIQUES", "LIVREURS", "COMPTABLE", "FINANCE", "SUIVI_COMMANDES", "UTILISATEURS", "TARIFS", "FACTURES", "RELEVES", "LITIGES", "EXPERTS", "MESSAGERIE", "EQUIPE_ADMIN", "PARAMETRES_PLATEFORME", "CENTRE_AIDE"],
  ADMIN_SALES: ["PILOTAGE", "BOUTIQUES", "SUIVI_COMMANDES", "TARIFS", "LITIGES", "CENTRE_AIDE"],
  ADMIN_FINANCE: ["PILOTAGE", "FINANCE", "FACTURES", "TARIFS", "RELEVES", "CENTRE_AIDE"],
  ADMIN_OPS: ["PILOTAGE", "SUIVI_COMMANDES", "LITIGES", "RELEVES", "BOUTIQUES", "CENTRE_AIDE"],
  ADMIN_LOGISTICS: ["PILOTAGE", "LIVREURS", "SUIVI_COMMANDES", "CENTRE_AIDE"],
  ADMIN_MARKETING: ["PILOTAGE", "BOUTIQUES", "MESSAGERIE", "CENTRE_AIDE"],
  ADMIN_SUPPORT: ["PILOTAGE", "UTILISATEURS", "LITIGES", "MESSAGERIE", "SUIVI_COMMANDES", "EXPERTS", "CENTRE_AIDE"],
  ADMIN_AUDITOR: ["PILOTAGE", "FINANCE", "FACTURES", "RELEVES", "CENTRE_AIDE"],
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const navRef = useRef<HTMLElement>(null);
  useScrollNavActifEnVue(navRef, pathname ?? "");

  // `menu` = la clé MenuAdmin (API) correspondant à chaque lien — sert au
  // filtrage ci-dessous.
  const LIENS = [
    { href: "/admin/pilotage", label: t("nav_tableauDeBord"), menu: "PILOTAGE" },
    { href: "/admin/boutiques", label: t("nav_boutiques"), menu: "BOUTIQUES" },
    { href: "/admin/livreurs", label: t("nav_livreurs"), menu: "LIVREURS" },
    { href: "/admin/comptable", label: t("titre_accueil"), menu: "COMPTABLE" },
    { href: "/admin/finance", label: t("nav_finance"), menu: "FINANCE" },
    { href: "/admin/suivi-commandes", label: t("nav_suiviCommandes"), menu: "SUIVI_COMMANDES" },
    { href: "/admin/utilisateurs", label: t("nav_utilisateurs"), menu: "UTILISATEURS" },
    { href: "/admin/tarifs", label: t("nav_tarifs"), menu: "TARIFS" },
    { href: "/admin/factures", label: t("nav_factures"), menu: "FACTURES" },
    { href: "/admin/releves", label: t("nav_releves"), menu: "RELEVES" },
    { href: "/admin/litiges", label: t("nav_litiges"), menu: "LITIGES" },
    { href: "/admin/experts", label: t("nav_experts"), menu: "EXPERTS" },
    { href: "/admin/messagerie", label: t("nav_messagerie"), menu: "MESSAGERIE" },
    { href: "/admin/equipe", label: t("nav_equipeAdmin"), menu: "EQUIPE_ADMIN" },
    { href: "/admin/parametres", label: t("nav_parametresPlateforme"), menu: "PARAMETRES_PLATEFORME" },
    { href: "/admin/centre-aide", label: t("nav_centreAide"), menu: "CENTRE_AIDE" },
    // Guide développeur/architecture (demande du 11 nov. 2026) — pas de clé
    // i18n (page volontairement non traduite, voir son commentaire d'en-tête)
    // et pas de nouvelle valeur `MenuAdmin` en base : rattaché au même
    // périmètre que « Centre d'aide », que tous les rôles admin possèdent
    // déjà par défaut (voir MENUS_PAR_ROLE_ADMIN ci-dessus), pour que ce
    // guide reste visible à toute l'équipe admin sans migration de schéma.
    { href: "/admin/guide-developpeur", label: "Guide développeur", menu: "CENTRE_AIDE" },
  ];

  // `adminMenuItems` (GET /auth/me, calculé côté API — voir
  // AdminTeamService/menu-admin.util.ts) prime dès qu'il est disponible sur
  // la table de secours par rôle ci-dessus.
  const [menuItems, setMenuItems] = useState<string[] | null>(null);
  useEffect(() => {
    if (!user?.role?.startsWith("ADMIN_")) return;
    api
      .get<{ adminMenuItems?: string[] }>("/auth/me")
      .then((moi) => setMenuItems(moi.adminMenuItems ?? null))
      .catch(() => setMenuItems(null));
  }, [user?.id]);

  const ecransAutorises = menuItems ?? (user?.role ? MENUS_PAR_ROLE_ADMIN[user.role] : undefined) ?? LIENS.map((l) => l.menu);
  const liens = LIENS.filter((l) => ecransAutorises.includes(l.menu));

  // (13 nov. 2026, signalement "connexion réussie mais revient à la page de
  // connexion") — se fier uniquement à `user` (contexte React) pour décider
  // de rediriger expose une fenêtre de course : juste après login(), le
  // jeton est déjà écrit dans localStorage de façon synchrone, mais le
  // contexte AuthProvider peut prendre un rendu de plus à répercuter le
  // nouvel utilisateur ici — si cette coquille vérifie juste avant ce
  // rendu, elle renvoie à tort vers la connexion un utilisateur pourtant
  // bien authentifié. On revérifie donc directement le jeton stocké avant
  // de rediriger ; le serveur reste de toute façon la seule vraie barrière
  // (JwtAuthGuard côté API).
  useEffect(() => {
    if (!loading && !user && !getToken()) router.replace("/admin/connexion");
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
      {/* Enveloppe sticky (retour client du 12 nov. 2026 : "la fixation des
          en-têtes dans la plateforme lors du défilement ou navigation n'est
          toujours pas effective") — voir aussi GestionShell. */}
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          {/* Volet "passerelle entre modules" (demande du 13 nov. 2026 :
              "ajouter les 3 barres/volet vertical à tous les modules") —
              jusqu'ici réservé aux en-têtes publics (SiteHeader,
              MarketplaceHeader), maintenant aussi dans chaque espace
              authentifié pour rejoindre un autre module sans repasser par
              l'accueil. */}
          <div className={styles.groupeMarque}>
            <ModulesMenu />
            <span className={styles.marque}>
              <LogoMark size={28} />
              ELEGANZ <span>Centre de pilotage</span>
            </span>
          </div>
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
        <BandeMarque />
        <nav className={styles.nav} ref={navRef}>
          {liens.map((lien) => {
            const actif = pathname === lien.href || pathname?.startsWith(`${lien.href}/`);
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
      <Footer variante="admin" />
      <ChatWidget />
    </div>
  );
}
