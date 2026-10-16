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

  // `menu` = la clé MenuGestion (API) correspondant à chaque lien — sert au
  // filtrage ci-dessous (16 oct. 2026, point 2 des propositions du 16 oct.
  // 2026 : "le rôle accordé aux équipes ne restreint pas le menu").
  const LIENS = [
    { href: "/caisse", label: t("nav_caisse"), menu: "CAISSE" },
    { href: "/tableau-de-bord", label: t("nav_tableauDeBord"), menu: "TABLEAU_DE_BORD" },
    { href: "/catalogue", label: t("nav_catalogue"), menu: "CATALOGUE" },
    { href: "/commandes", label: t("nav_commandes"), menu: "COMMANDES" },
    { href: "/factures", label: t("nav_mesFactures"), menu: "FACTURES" },
    { href: "/releves", label: t("nav_releves"), menu: "RELEVES" },
    { href: "/litiges", label: t("nav_litiges"), menu: "LITIGES" },
    { href: "/finance", label: t("nav_finance"), menu: "FINANCE" },
    { href: "/livreurs", label: t("nav_livreurs"), menu: "LIVREURS" },
    { href: "/messagerie", label: t("nav_messagerie"), menu: "MESSAGERIE" },
    { href: "/equipe", label: t("nav_equipe"), menu: "EQUIPE" },
    { href: "/parametres", label: t("nav_parametres"), menu: "PARAMETRES" },
  ];

  // Filtre générique par écran accordé (remplace l'ancien cas particulier
  // unique réservé au comptable externe) — `currentShop.menuItems` vient de
  // GET /shops/mine, calculé côté API (ShopsService.ecransEffectifs) à
  // partir du rôle et d'un éventuel choix explicite du propriétaire/gérant.
  // Tant que la boutique n'a pas encore chargé, on affiche tout (rien
  // derrière ce menu n'est accessible sans la vraie barrière API de toute
  // façon) ; une fois chargée, la liste reçue fait foi, y compris vide.
  const liens = currentShop?.menuItems ? LIENS.filter((l) => currentShop.menuItems!.includes(l.menu)) : LIENS;

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
              title={t("horsLigne_cliquerSynchroniser")}
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
              router.push("/");
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
