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
import { OfflineSyncProvider, useOfflineSync } from "../lib/offline-sync";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import styles from "./ComptableShell.module.css";

/**
 * Coquille d'ELEGANZ Secourable (prompt du 13 oct. 2026, §3) — espace
 * fonctionnellement autonome (pas de boutique requise). Aucun rôle imposé
 * côté serveur : n'importe quel compte ELEGANZ peut utiliser Secourable
 * (voir AuthService.login). Depuis le 11 nov. 2026, sa propre clé de jeton
 * (espaceAuth() === "comptable", voir api.ts) exige malgré tout une vraie
 * reconnexion dédiée (/comptable/connexion) — ne réutilise plus
 * silencieusement une session déjà ouverte pour Gestion/Marketplace.
 *
 * `LocaleProvider` (prompt §21 + réponse du 13 oct. 2026) est monté une
 * seule fois à la racine (`app/layout.tsx`, généralisé le 15 oct. 2026) —
 * `useLocale()` ci-dessous lit ce contexte partagé, plus besoin de le
 * remonter ici.
 *
 * Enveloppé dans OfflineSyncProvider (réponse du 13 oct. 2026, point 2 :
 * "saisie différée synchronisée au retour du réseau") — même contexte déjà
 * utilisé côté Caisse (apps/web/app/(gestion)/layout.tsx), ici pour que la
 * saisie rapide du Carnet puisse se mettre en file d'attente hors-ligne et
 * se synchroniser automatiquement, voir activites/[id]/page.tsx.
 */
export function ComptableShell({ children }: { children: React.ReactNode }) {
  return (
    <OfflineSyncProvider>
      <ComptableShellInterieur>{children}</ComptableShellInterieur>
    </OfflineSyncProvider>
  );
}

function ComptableShellInterieur({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t, reviewRecommended } = useLocale();
  const { nombreEnAttente, synchroniser } = useOfflineSync();
  const navRef = useRef<HTMLElement>(null);
  useScrollNavActifEnVue(navRef, pathname ?? "");

  // Indication (sans bloquer la navigation, le serveur reste la seule
  // véritable barrière — voir ComptableService.agenda/exportDossierFinancement)
  // des liens non inclus dans le bouquet actuel de l'abonné, demandée dans le
  // retour client du 12 nov. 2026 ("masquer/indiquer dans la nav les liens
  // correspondant à des fonctionnalités non incluses dans le bouquet actuel").
  const [fonctionnalitesBouquet, setFonctionnalitesBouquet] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ bouquet: { featuresJson?: Record<string, unknown> } | null }>("/comptable/subscription")
      .then((s) => setFonctionnalitesBouquet(s.bouquet?.featuresJson ?? {}))
      .catch(() => setFonctionnalitesBouquet(null));
  }, [user]);

  // Voir le commentaire détaillé dans AdminShell.tsx (13 nov. 2026) : on
  // revérifie le jeton stocké avant de rediriger, pour ne pas renvoyer à
  // tort vers la connexion un utilisateur fraîchement authentifié pendant
  // le court instant où le contexte React n'a pas encore répercuté `user`.
  useEffect(() => {
    if (!loading && !user && !getToken()) router.replace("/comptable/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;

  // Regroupement visuel du menu (voir ComptableShell.module.css, .navGroupe /
  // .navSeparateur) : "Activité quotidienne" (usage fréquent), "Pilotage"
  // (suivi financier, dont le Dossier de financement — anciennement accessible
  // uniquement en lien profond depuis /comptable/chiffres) et "Compte".
  // `cleFonctionnalite` (optionnelle, typée explicitement pour éviter toute
  // ambiguïté d'inférence TS sur un tableau à formes mixtes) indique la
  // fonctionnalité de bouquet dont ce lien dépend — voir fonctionnalitesBouquet.
  type LienNav = { href: string; label: string; icone: string; cleFonctionnalite?: string };
  const GROUPES_NAV: { liens: LienNav[] }[] = [
    {
      liens: [
        { href: "/comptable", label: t("nav_accueil"), icone: "🏠" },
        { href: "/comptable/activites", label: t("nav_mesActivites"), icone: "📋" },
        { href: "/comptable/agenda", label: t("nav_agenda"), icone: "📅", cleFonctionnalite: "rappelsAgenda" },
      ],
    },
    {
      liens: [
        { href: "/comptable/chiffres", label: t("nav_chiffres"), icone: "📊" },
        { href: "/comptable/dossier-financement", label: t("titre_dossierFinancement"), icone: "💰", cleFonctionnalite: "exportDossierFinancement" },
      ],
    },
    {
      liens: [
        { href: "/comptable/profil", label: t("market_monCompte"), icone: "👤" },
        { href: "/comptable/messagerie", label: t("nav_messagerie"), icone: "💬" },
        { href: "/comptable/abonnement", label: t("nav_abonnement"), icone: "⭐" },
      ],
    },
  ];

  return (
    <div className={styles.cadre}>
      {/* Enveloppe sticky (retour client du 12 nov. 2026 : "la fixation des
          en-têtes dans la plateforme lors du défilement ou navigation n'est
          toujours pas effective") — voir aussi GestionShell/AdminShell/LivreurShell. */}
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          <span className={styles.marque}>
            <LogoMark size={28} />
            ELEGANZ <span>{t("titre_accueil")}</span>
          </span>
          <div className={styles.enteteActions}>
            <AccueilLien />
            {nombreEnAttente > 0 && (
              <button
                className={styles.pendingSync}
                onClick={synchroniser}
                title={t("horsLigne_cliquerSynchroniser")}
              >
                {nombreEnAttente} {t("horsLigne_enAttente")}
              </button>
            )}
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
          {GROUPES_NAV.map((groupe, indexGroupe) => (
            <div className={styles.navGroupe} key={indexGroupe}>
              {groupe.liens.map((lien) => {
                const actif = pathname === lien.href;
                const nonInclus =
                  lien.cleFonctionnalite && fonctionnalitesBouquet
                    ? fonctionnalitesBouquet[lien.cleFonctionnalite] !== true
                    : false;
                return (
                  <Link
                    key={lien.href}
                    href={lien.href}
                    className={`${styles.navLien} ${actif ? styles.navLienActif : ""}`}
                    data-nav-actif={actif ? "true" : undefined}
                    title={nonInclus ? t("abo_nonInclusBouquet") : undefined}
                  >
                    <span aria-hidden="true">{lien.icone}</span> {lien.label}
                    {nonInclus && <span aria-hidden="true"> 🔒</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="comptable" />
      <ChatWidget />
    </div>
  );
}
