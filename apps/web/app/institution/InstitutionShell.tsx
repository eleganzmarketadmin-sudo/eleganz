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
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import styles from "./InstitutionShell.module.css";

interface ProfilInstitution {
  id: string;
  name: string;
  type: "MICROFINANCE" | "BANQUE" | "COOPERATIVE" | "AUTRE";
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED";
  rejectionNote: string | null;
}

/**
 * Coquille du portail institutions (14 nov. 2026 — microfinances, banques,
 * coopératives). Pas de ModulesMenu ici volontairement : contrairement à
 * Gestion/Marketplace/Secourable/Experts (modules self-service, voir
 * ModulesMenu.tsx), ce portail a son propre lien dédié dans le volet
 * vertical (voir ModulesMenu.tsx — carte "institution"), pas une inscription
 * mêlée aux autres modules.
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

  const LIENS = [
    { href: "/institution", label: t("inst_nav_boutiques"), icone: "🏬" },
    { href: "/institution/decisions", label: t("inst_nav_decisions"), icone: "📝" },
    { href: "/institution/prets", label: t("inst_nav_prets"), icone: "💰" },
  ];

  return (
    <div className={styles.cadre}>
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          <div className={styles.groupeMarque}>
            <span className={styles.marque}>
              <LogoMark size={28} />
              ELEGANZ <span>{t("inst_titreMarque")}</span>
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
        {navigationActive && (
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
                  <span aria-hidden="true">{lien.icone}</span> {lien.label}
                </Link>
              );
            })}
          </nav>
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
