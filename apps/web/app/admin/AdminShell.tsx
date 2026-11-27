"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { api, getToken } from "../lib/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { CurrencySwitcher } from "../components/CurrencySwitcher";
import { TauxDuJourBanner } from "./TauxDuJourBanner";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { ModulesMenu } from "../components/ModulesMenu";
import { DropdownNavGroup } from "../components/DropdownNavGroup";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import { useVoletRepliable } from "../lib/useVoletRepliable";
import styles from "./AdminShell.module.css";

interface LienSimple {
  href: string;
  label: string;
  menu: string;
}

interface GroupeNav {
  groupeLabel: string;
  liens: LienSimple[];
}

function estGroupe(e: LienSimple | GroupeNav): e is GroupeNav {
  return "liens" in e;
}

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
  ADMIN_SUPER: ["PILOTAGE", "BOUTIQUES", "LIVREURS", "COMPTABLE", "FINANCE", "SUIVI_COMMANDES", "UTILISATEURS", "TARIFS", "BOOST", "FACTURES", "RELEVES", "LITIGES", "EXPERTS", "MESSAGERIE", "EQUIPE_ADMIN", "PARAMETRES_PLATEFORME", "AUDIT", "MODERATION", "CENTRE_AIDE"],
  ADMIN_SALES: ["PILOTAGE", "BOUTIQUES", "SUIVI_COMMANDES", "TARIFS", "LITIGES", "BOOST", "CENTRE_AIDE"],
  ADMIN_FINANCE: ["PILOTAGE", "FINANCE", "FACTURES", "TARIFS", "RELEVES", "BOOST", "CENTRE_AIDE"],
  ADMIN_OPS: ["PILOTAGE", "SUIVI_COMMANDES", "LITIGES", "RELEVES", "BOUTIQUES", "MODERATION", "CENTRE_AIDE"],
  ADMIN_LOGISTICS: ["PILOTAGE", "LIVREURS", "SUIVI_COMMANDES", "CENTRE_AIDE"],
  ADMIN_MARKETING: ["PILOTAGE", "BOUTIQUES", "MESSAGERIE", "BOOST", "CENTRE_AIDE"],
  ADMIN_SUPPORT: ["PILOTAGE", "UTILISATEURS", "LITIGES", "MESSAGERIE", "SUIVI_COMMANDES", "EXPERTS", "MODERATION", "CENTRE_AIDE"],
  // AUDIT (journal d'audit interne, 18 nov. 2026) : ce rôle existe
  // précisément pour ce type de consultation — voir menu-admin.util.ts.
  // MODERATION (24 nov. 2026) : même logique de contrôle/conformité.
  ADMIN_AUDITOR: ["PILOTAGE", "FINANCE", "FACTURES", "RELEVES", "AUDIT", "MODERATION", "CENTRE_AIDE"],
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
  //
  // Regroupement en menus déroulants (19 nov. 2026, demande du
  // propriétaire : "créer des options navigables au sein de ses menus ...
  // au lieu de défiler sur une longue page interminable des listes
  // d'options" — cette barre comptait jusqu'ici 19 onglets à plat qui
  // débordaient horizontalement). Chaque groupe ne filtre que ses propres
  // enfants par `ecransAutorises` (ci-dessous) ; un groupe sans aucun enfant
  // visible disparaît entièrement, un groupe réduit à un seul enfant visible
  // se replie en lien simple (voir le rendu de <nav> plus bas) — jamais un
  // menu déroulant vide ou à un seul choix.
  const GROUPE_FINANCE: LienSimple[] = [
    { href: "/admin/finance", label: t("nav_finance"), menu: "FINANCE" },
    { href: "/admin/factures", label: t("nav_factures"), menu: "FACTURES" },
    { href: "/admin/tarifs", label: t("nav_tarifs"), menu: "TARIFS" },
    // ELEGANZ BOOST (27 nov. 2026) : tarification/promotions/canaux/rapport
    // Boost, écran dédié (MenuAdmin.BOOST) distinct de TARIFS ci-dessus.
    { href: "/admin/boost", label: t("nav_boost"), menu: "BOOST" },
    { href: "/admin/releves", label: t("nav_releves"), menu: "RELEVES" },
  ];
  const GROUPE_OPERATIONS: LienSimple[] = [
    { href: "/admin/boutiques", label: t("nav_boutiques"), menu: "BOUTIQUES" },
    { href: "/admin/livreurs", label: t("nav_livreurs"), menu: "LIVREURS" },
    { href: "/admin/suivi-commandes", label: t("nav_suiviCommandes"), menu: "SUIVI_COMMANDES" },
    { href: "/admin/litiges", label: t("nav_litiges"), menu: "LITIGES" },
    { href: "/admin/experts", label: t("nav_experts"), menu: "EXPERTS" },
    { href: "/admin/moderation", label: t("nav_moderation"), menu: "MODERATION" },
  ];
  const GROUPE_COMPTES: LienSimple[] = [
    { href: "/admin/utilisateurs", label: t("nav_utilisateurs"), menu: "UTILISATEURS" },
    { href: "/admin/equipe", label: t("nav_equipeAdmin"), menu: "EQUIPE_ADMIN" },
    // Institutions financières partenaires (14 nov. 2026) — rattaché au même
    // écran "EQUIPE_ADMIN" (réservé à ADMIN_SUPER par défaut, voir
    // MENUS_PAR_ROLE_ADMIN ci-dessus) que la gestion de l'équipe admin : les
    // deux attribuent un rôle à un compte existant (ici INSTITUTION_STAFF),
    // ce qui doit rester aussi verrouillé — voir AdminInstitutionsController
    // (requireSuperAdmin). Pas de nouvelle valeur MenuAdmin dédiée pour
    // éviter une migration seulement pour un filtre de menu.
    { href: "/admin/institutions", label: t("nav_institutions"), menu: "EQUIPE_ADMIN" },
  ];
  const GROUPE_SYSTEME: LienSimple[] = [
    { href: "/admin/parametres", label: t("nav_parametresPlateforme"), menu: "PARAMETRES_PLATEFORME" },
    { href: "/admin/audit", label: t("nav_audit"), menu: "AUDIT" },
    { href: "/admin/centre-aide", label: t("nav_centreAide"), menu: "CENTRE_AIDE" },
    // Guide développeur/architecture (demande du 11 nov. 2026) — pas de clé
    // i18n (page volontairement non traduite, voir son commentaire d'en-tête)
    // et pas de nouvelle valeur `MenuAdmin` en base : rattaché au même
    // périmètre que « Centre d'aide », que tous les rôles admin possèdent
    // déjà par défaut (voir MENUS_PAR_ROLE_ADMIN ci-dessus), pour que ce
    // guide reste visible à toute l'équipe admin sans migration de schéma.
    { href: "/admin/guide-developpeur", label: "Guide développeur", menu: "CENTRE_AIDE" },
  ];

  const ENTREES: (LienSimple | GroupeNav)[] = [
    { href: "/admin/pilotage", label: t("nav_tableauDeBord"), menu: "PILOTAGE" },
    { groupeLabel: t("nav_finance"), liens: GROUPE_FINANCE },
    { groupeLabel: t("admshell_groupeOperations"), liens: GROUPE_OPERATIONS },
    { groupeLabel: t("admshell_groupeComptes"), liens: GROUPE_COMPTES },
    { href: "/admin/comptable", label: t("titre_accueil"), menu: "COMPTABLE" },
    { href: "/admin/messagerie", label: t("nav_messagerie"), menu: "MESSAGERIE" },
    { groupeLabel: t("admshell_groupeSysteme"), liens: GROUPE_SYSTEME },
  ];

  // Mise à plat pour le repli par défaut ci-dessous (ecransAutorises) —
  // même liste qu'avant ce regroupement, juste reconstituée depuis les
  // groupes plutôt qu'un unique tableau LIENS.
  const LIENS: LienSimple[] = ENTREES.flatMap((e) => (estGroupe(e) ? e.liens : [e]));

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

  // Repli de la barre d'onglets et du bloc options sur téléphone (21 nov.
  // 2026, retour client — "étaler ces modifications à tous les modules" —
  // mécanisme déjà en place sur GestionShell, voir son commentaire détaillé.
  // `useVoletRepliable` centralise ici ce qui y était écrit à la main
  // (fermeture à Échap/clic en dehors/changement de page) ; l'exclusion
  // mutuelle entre les deux volets reste composée explicitement sur chaque
  // bouton ci-dessous, comme sur GestionShell.
  const nav = useVoletRepliable(pathname);
  const options = useVoletRepliable(pathname);
  const lienActifMobile = LIENS.find((l) => pathname === l.href || pathname?.startsWith(`${l.href}/`));
  const libelleNavMobile = lienActifMobile?.label ?? t("gshell_menu");

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
          <div className={styles.optionsBloc} ref={options.ref}>
            {/* 25 nov. 2026, retour propriétaire : cloche toujours visible,
                hors du volet replié — voir le commentaire détaillé dans
                GestionShell.tsx, même mécanisme à l'identique. */}
            <NotificationBell />
            <button
              type="button"
              className={styles.boutonOptionsMobile}
              onClick={() => {
                options.basculer();
                nav.setOuvert(false);
              }}
              aria-expanded={options.ouvert}
              aria-controls="admin-options"
              aria-label={t("gshell_options")}
              title={t("gshell_options")}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            <div id="admin-options" className={`${styles.enteteActions} ${options.ouvert ? styles.enteteActionsOuvert : ""}`}>
              <AccueilLien etiquette />
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
        <BandeMarque couleur="var(--color-or)" />
        <button
          type="button"
          className={styles.boutonNavMobile}
          onClick={() => {
            nav.basculer();
            options.setOuvert(false);
          }}
          aria-expanded={nav.ouvert}
          aria-controls="admin-nav"
        >
          <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
            ☰
          </span>
          <span className={styles.boutonNavMobileLabel}>{libelleNavMobile}</span>
          <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
            {nav.ouvert ? "▴" : "▾"}
          </span>
        </button>
        <nav id="admin-nav" className={`${styles.nav} ${nav.ouvert ? styles.navOuvert : ""}`} ref={navRef}>
          {ENTREES.map((entree, index) => {
            if (!estGroupe(entree)) {
              if (!ecransAutorises.includes(entree.menu)) return null;
              const actif = pathname === entree.href || pathname?.startsWith(`${entree.href}/`);
              return (
                <Link
                  key={entree.href}
                  href={entree.href}
                  className={`${styles.navLien} ${actif ? styles.navLienActif : ""}`}
                  data-nav-actif={actif ? "true" : undefined}
                  onClick={() => nav.setOuvert(false)}
                >
                  {entree.label}
                </Link>
              );
            }

            const liensVisibles = entree.liens.filter((l) => ecransAutorises.includes(l.menu));
            if (liensVisibles.length === 0) return null;
            if (liensVisibles.length === 1) {
              const seul = liensVisibles[0];
              const actif = pathname === seul.href || pathname?.startsWith(`${seul.href}/`);
              return (
                <Link
                  key={seul.href}
                  href={seul.href}
                  className={`${styles.navLien} ${actif ? styles.navLienActif : ""}`}
                  data-nav-actif={actif ? "true" : undefined}
                  onClick={() => nav.setOuvert(false)}
                >
                  {seul.label}
                </Link>
              );
            }
            const actifGroupe = liensVisibles.some((l) => pathname === l.href || pathname?.startsWith(`${l.href}/`));
            return (
              <DropdownNavGroup
                key={`groupe-${index}`}
                label={entree.groupeLabel}
                enfants={liensVisibles}
                actif={actifGroupe}
                triggerClassName={styles.navLien}
                activeClassName={styles.navLienActif}
              />
            );
          })}
        </nav>
        <TauxDuJourBanner peutModifierTaux={ecransAutorises.includes("TARIFS")} />
      </div>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="admin" />
      <ChatWidget />
    </div>
  );
}
