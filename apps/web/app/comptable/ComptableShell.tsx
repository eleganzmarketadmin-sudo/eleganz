"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoMark, BandeMarque } from "../components/Logo";
import { Footer } from "../components/Footer";
import { NotificationBell } from "../components/NotificationBell";
import { ChatWidget } from "../components/ChatWidget";
import { AccueilLien } from "../components/AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { OfflineSyncProvider, useOfflineSync } from "../lib/offline-sync";
import styles from "./ComptableShell.module.css";

/**
 * Coquille d'ELEGANZ Secourable (prompt du 13 oct. 2026, §3) — espace
 * fonctionnellement autonome (pas de boutique requise), mais partage le
 * compte ELEGANZ commun : contrairement à l'espace livreur ou admin, aucune
 * clé de jeton séparée, aucun rôle imposé — n'importe quel compte ELEGANZ
 * authentifié peut utiliser Secourable (voir espaceAuth() dans api.ts,
 * qui range tout ce qui n'est pas /admin ou /livreur dans le même espace
 * "défaut" que la Marketplace et Gestion).
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

  useEffect(() => {
    if (!loading && !user) router.replace("/marketplace/compte?retour=/comptable");
  }, [loading, user, router]);

  if (loading || !user) return null;

  // Regroupement visuel du menu (voir ComptableShell.module.css, .navGroupe /
  // .navSeparateur) : "Activité quotidienne" (usage fréquent), "Pilotage"
  // (suivi financier, dont le Dossier de financement — anciennement accessible
  // uniquement en lien profond depuis /comptable/chiffres) et "Compte".
  const GROUPES_NAV = [
    {
      liens: [
        { href: "/comptable", label: t("nav_accueil"), icone: "🏠" },
        { href: "/comptable/activites", label: t("nav_mesActivites"), icone: "📋" },
        { href: "/comptable/agenda", label: t("nav_agenda"), icone: "📅" },
      ],
    },
    {
      liens: [
        { href: "/comptable/chiffres", label: t("nav_chiffres"), icone: "📊" },
        { href: "/comptable/dossier-financement", label: t("titre_dossierFinancement"), icone: "💰" },
      ],
    },
    {
      liens: [
        { href: "/comptable/messagerie", label: t("nav_messagerie"), icone: "💬" },
        { href: "/comptable/abonnement", label: t("nav_abonnement"), icone: "⭐" },
      ],
    },
  ];

  return (
    <div className={styles.cadre}>
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
      <nav className={styles.nav}>
        {GROUPES_NAV.map((groupe, indexGroupe) => (
          <div className={styles.navGroupe} key={indexGroupe}>
            {groupe.liens.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className={`${styles.navLien} ${pathname === lien.href ? styles.navLienActif : ""}`}
              >
                <span aria-hidden="true">{lien.icone}</span> {lien.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="comptable" />
      <ChatWidget />
    </div>
  );
}
