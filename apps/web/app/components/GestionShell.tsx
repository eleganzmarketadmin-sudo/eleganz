"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import { useOfflineSync } from "../lib/offline-sync";
import { ThemeToggle } from "./ThemeToggle";
import { LogoMark, BandeMarque } from "./Logo";
import { Footer } from "./Footer";
import { NotificationBell } from "./NotificationBell";
import { ChatWidget } from "./ChatWidget";
import { AccueilLien } from "./AccueilLien";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import styles from "./GestionShell.module.css";

export function GestionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { shops, currentShop, setCurrentShopId } = useShop();
  const { nombreEnAttente, synchroniser } = useOfflineSync();
  const { t } = useLocale();

  const LIENS = [
    { href: "/caisse", label: t("nav_caisse") },
    { href: "/tableau-de-bord", label: t("nav_tableauDeBord") },
    { href: "/catalogue", label: t("nav_catalogue") },
    { href: "/commandes", label: t("nav_commandes") },
    { href: "/factures", label: t("nav_mesFactures") },
    { href: "/releves", label: t("nav_releves") },
    { href: "/litiges", label: t("nav_litiges") },
    { href: "/finance", label: t("nav_finance") },
    { href: "/livreurs", label: t("nav_livreurs") },
    { href: "/messagerie", label: t("nav_messagerie") },
    { href: "/equipe", label: t("nav_equipe") },
    { href: "/parametres", label: t("nav_parametres") },
  ];

  // Un comptable externe (StaffRole.EXTERNAL_ACCOUNTANT) n'a, côté API, accès
  // qu'en lecture seule à Finance & Comptabilité (docs/ARCHITECTURE_FINANCE.md
  // §8sexies) — masquer les autres onglets évite de lui montrer un lien qui
  // échouerait systématiquement avec une erreur 403.
  const LIEN_FINANCE_SEUL = LIENS.filter((l) => l.href === "/finance");
  const liens = currentShop?.myRole === "EXTERNAL_ACCOUNTANT" ? LIEN_FINANCE_SEUL : LIENS;

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <div className={styles.marqueBloc}>
          <LogoMark size={30} />
          <div>
            <div className={styles.marque}>
              ELEGANZ <span>{t("nom_gestion")}</span>
            </div>
            {currentShop && <div className={styles.boutiqueNom}>{currentShop.name}</div>}
          </div>
        </div>
        <div className={styles.droite}>
          <AccueilLien />
          {nombreEnAttente > 0 && (
            <button
              onClick={synchroniser}
              title="Cliquer pour tenter de synchroniser maintenant"
              style={{
                background: "var(--color-or)",
                color: "var(--color-encre-fixe)",
                border: "none",
                padding: "8px 12px",
                minHeight: "40px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {nombreEnAttente} vente(s) en attente de synchronisation
            </button>
          )}
          {shops.length > 1 && (
            <select
              aria-label="Choisir la boutique"
              value={currentShop?.id ?? ""}
              onChange={(e) => setCurrentShopId(e.target.value)}
              style={{ padding: "8px", minHeight: "40px" }}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/connexion");
            }}
          >
            {t("action_seDeconnecter")}
          </button>
        </div>
      </header>
      <BandeMarque />
      <nav className={styles.nav}>
        {liens.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${
              pathname === lien.href || pathname?.startsWith(`${lien.href}/`) ? styles.navLienActif : ""
            }`}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="gestion" />
      <ChatWidget />
    </div>
  );
}
