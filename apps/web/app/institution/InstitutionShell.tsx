"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { api, getToken } from "../lib/api";
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
import styles from "./InstitutionShell.module.css";

interface ProfilInstitution {
  id: string;
  name: string;
  type: "MICROFINANCE" | "BANQUE" | "COOPERATIVE" | "AUTRE";
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED";
  rejectionNote: string | null;
  // Rôle/menu du membre connecté au sein de SON institution (16 nov. 2026,
  // gestion d'équipe) — calculés côté API par
  // InstitutionPortalService.monProfil (via InstitutionStaff), jamais
  // recalculés ici. `monMenu` pilote quels liens de navigation s'affichent
  // ci-dessous, exactement comme GestionShell le fait avec les écrans
  // accordés d'un ShopStaff.
  monRole: string;
  monMenu: string[];
  staffActif: boolean;
}

// Mêmes clés que MenuInstitution côté API — tant que `profil` n'est pas
// encore chargé, on affiche tout (comme `navigationActive` ci-dessous le
// fait déjà pour le statut), pour éviter un flash de navigation vide.
const TOUS_LES_ECRANS_INSTITUTION = [
  "RECEPTION",
  "ANALYSE",
  "DECISIONS",
  "RENDEZ_VOUS",
  "PRETS",
  "MESSAGERIE",
  "RAPPORTS",
  "EQUIPE",
  "PARAMETRES",
];

/**
 * Coquille du portail institutions (14 nov. 2026 — microfinances, banques,
 * coopératives).
 *
 * ModulesMenu (18 nov. 2026, correction d'incohérence signalée par le
 * propriétaire) : le volet vertical "3 barres" avait été généralisé à tous
 * les modules le 13 nov. 2026 (voir le commentaire dans AdminShell.tsx),
 * mais ce portail — créé le lendemain — ne l'avait jamais reçu. Même
 * emplacement que les autres coquilles (GestionShell, ComptableShell,
 * LivreurShell, AdminShell, MarketplaceHeader) : juste avant le logo, dans
 * `.groupeMarque`.
 *

 * Pas de garde de rôle dédiée côté front : si le compte connecté n'a pas de
 * profil Institution, GET /institution-portal/me renvoie 404 et l'écran
 * l'affiche tel quel plutôt que de deviner — la vraie barrière reste
 * InstitutionPortalService.monProfil côté API.
 *
 * Revirement du 14 nov. 2026 (auto-inscription, voir
 * institution/inscription/page.tsx) : un profil existe désormais pour tout
 * statut (PENDING/REJECTED compris, pas seulement ACTIVE/SUSPENDED comme
 * avant), et chaque appel réel de l'API revérifie
 * exigerInstitutionActive(moi) côté serveur — donc tant que le statut n'est
 * pas ACTIVE, la navigation et le contenu seraient de toute façon inutiles
 * (tout renverrait 403). On remplace ici {children} par un écran d'état
 * dédié plutôt que de laisser l'utilisateur cliquer dans le vide.
 */
export function InstitutionShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const navRef = useRef<HTMLElement>(null);
  useScrollNavActifEnVue(navRef, pathname ?? "");

  // Repli de la barre d'onglets et du bloc options sur téléphone (21 nov.
  // 2026, retour propriétaire — "étaler ces modifications à tous les
  // modules", voir le commentaire détaillé dans GestionShell.tsx).
  const nav = useVoletRepliable(pathname);
  const options = useVoletRepliable(pathname);

  const [profil, setProfil] = useState<ProfilInstitution | null>(null);
  const [erreurProfil, setErreurProfil] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<ProfilInstitution>("/institution-portal/me")
      .then(setProfil)
      .catch((err) => setErreurProfil(err instanceof Error ? err.message : null));
  }, [user]);

  // Voir le commentaire détaillé dans AdminShell.tsx (13 nov. 2026) : on
  // revérifie le jeton stocké avant de rediriger, pour ne pas renvoyer à
  // tort vers la connexion un utilisateur fraîchement authentifié pendant
  // le court instant où le contexte React n'a pas encore répercuté `user`.
  useEffect(() => {
    if (!loading && !user && !getToken()) router.replace("/institution/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;

  // Tant qu'on ne sait pas encore (profil pas chargé) ou qu'il n'y a pas de
  // profil (erreurProfil, cas admin/legacy), on affiche la navigation comme
  // avant — seul un profil chargé et explicitement non-ACTIVE la masque.
  const navigationActive = !profil || profil.status === "ACTIVE";
  const monMenu = profil?.monMenu ?? TOUS_LES_ECRANS_INSTITUTION;

  // "Demandes" partage l'écran RECEPTION avec "Boutiques" (les deux sont des
  // vues de réception de dossiers/candidatures, voir le commentaire sur
  // ECRANS_MENU dans institution/equipe/page.tsx) ; RAPPORTS a reçu son
  // écran dédié le 19 nov. 2026 (voir institution/rapports/page.tsx) ;
  // ANALYSE/RENDEZ_VOUS/MESSAGERIE/PARAMETRES n'ont pas encore d'écran
  // dédié (Phase 2/3) donc aucun lien ici ne leur correspond encore.
  const LIENS = [
    { href: "/institution", label: t("inst_nav_boutiques"), icone: "🏬", ecran: "RECEPTION" },
    { href: "/institution/demandes", label: t("inst_nav_demandes"), icone: "🧾", ecran: "RECEPTION" },
    { href: "/institution/decisions", label: t("inst_nav_decisions"), icone: "📝", ecran: "DECISIONS" },
    { href: "/institution/prets", label: t("inst_nav_prets"), icone: "💰", ecran: "PRETS" },
    { href: "/institution/rapports", label: t("inst_nav_rapports"), icone: "📊", ecran: "RAPPORTS" },
    { href: "/institution/equipe", label: t("inst_nav_equipe"), icone: "👥", ecran: "EQUIPE" },
    { href: "/institution/parametres", label: t("inst_nav_parametres"), icone: "⚙️", ecran: "PARAMETRES" },
  ].filter((lien) => monMenu.includes(lien.ecran));

  const lienActifMobile = LIENS.find((l) => pathname === l.href);
  const libelleNavMobile = lienActifMobile?.label ?? t("gshell_menu");

  return (
    <div className={styles.cadre}>
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          <div className={styles.groupeMarque}>
            <ModulesMenu />
            <span className={styles.marque}>
              <LogoMark size={28} />
              ELEGANZ <span>{t("inst_titreMarque")}</span>
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
              aria-controls="institution-options"
              aria-label={t("gshell_options")}
              title={t("gshell_options")}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            <div id="institution-options" className={`${styles.enteteActions} ${options.ouvert ? styles.enteteActionsOuvert : ""}`}>
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
        <BandeMarque couleur="var(--color-institution-sur-fonce)" />
        {navigationActive && (
          <>
            <button
              type="button"
              className={styles.boutonNavMobile}
              onClick={() => {
                nav.basculer();
                options.setOuvert(false);
              }}
              aria-expanded={nav.ouvert}
              aria-controls="institution-nav"
            >
              <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
                ☰
              </span>
              <span className={styles.boutonNavMobileLabel}>{libelleNavMobile}</span>
              <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
                {nav.ouvert ? "▴" : "▾"}
              </span>
            </button>
            <nav id="institution-nav" className={`${styles.nav} ${nav.ouvert ? styles.navOuvert : ""}`} ref={navRef}>
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
                    <span aria-hidden="true">{lien.icone}</span> {lien.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">
          {!erreurProfil && profil && (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)", marginBottom: "var(--espace-3)" }}>
              {profil.name} · {t(`inst_type_${profil.type}`)}
            </p>
          )}
          {erreurProfil && (
            <div style={{ background: "var(--color-flamme)", color: "#fff", padding: "var(--espace-3)", marginBottom: "var(--espace-4)" }}>
              {erreurProfil}
            </div>
          )}
          {profil && profil.status !== "ACTIVE" ? (
            <div className={styles.ecranStatut}>
              <h2>
                {profil.status === "PENDING" && t("inst_statutEnAttenteTitre")}
                {profil.status === "REJECTED" && t("inst_statutRefuseTitre")}
                {profil.status === "SUSPENDED" && t("inst_statutSuspendu")}
              </h2>
              <p>
                {profil.status === "PENDING" && t("inst_statutEnAttenteTexte")}
                {profil.status === "REJECTED" && t("inst_statutRefuseTexte")}
                {profil.status === "SUSPENDED" && t("inst_statutSuspenduTexte")}
              </p>
              {profil.status === "REJECTED" && profil.rejectionNote && (
                <p className={styles.motifRefus}>
                  {t("inst_motifRefus")} {profil.rejectionNote}
                </p>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      <Footer variante="institution" />
      <ChatWidget />
    </div>
  );
}
