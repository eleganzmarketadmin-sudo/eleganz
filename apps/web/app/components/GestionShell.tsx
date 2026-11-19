"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import { useOfflineSync } from "../lib/offline-sync";
import { ThemeToggle } from "./ThemeToggle";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { LogoMark, BandeMarque } from "./Logo";
import { Footer } from "./Footer";
import { NotificationBell } from "./NotificationBell";
import { ChatWidget } from "./ChatWidget";
import { AccueilLien } from "./AccueilLien";
import { ModulesMenu } from "./ModulesMenu";
import { DropdownNavGroup } from "./DropdownNavGroup";
import { useLocale } from "../lib/i18n/LocaleContext";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useScrollNavActifEnVue } from "../lib/useScrollNavActif";
import styles from "./GestionShell.module.css";

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

export function GestionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { shops, currentShop, setCurrentShopId } = useShop();
  const { nombreEnAttente, synchroniser } = useOfflineSync();
  const { t } = useLocale();
  const navRef = useRef<HTMLElement>(null);
  useScrollNavActifEnVue(navRef, pathname ?? "");

  // `menu` = la clé MenuGestion (API) correspondant à chaque lien — sert au
  // filtrage ci-dessous (16 oct. 2026, point 2 des propositions du 16 oct.
  // 2026 : "le rôle accordé aux équipes ne restreint pas le menu").
  //
  // Regroupement en menus déroulants (19 nov. 2026, même demande que
  // AdminShell/AdminFinanceSubNav : "créer des options navigables au sein de
  // ses menus ... au lieu de défiler sur une longue page interminable des
  // listes d'options"). Chaque groupe ne filtre que ses propres enfants par
  // `currentShop.menuItems` (ci-dessous) ; un groupe sans aucun enfant
  // visible disparaît, un groupe réduit à un seul enfant visible se replie en
  // lien simple (voir le rendu de <nav> plus bas).
  const GROUPE_FINANCE: LienSimple[] = [
    { href: "/factures", label: t("nav_mesFactures"), menu: "FACTURES" },
    { href: "/releves", label: t("nav_releves"), menu: "RELEVES" },
    { href: "/finance", label: t("nav_finance"), menu: "FINANCE" },
  ];
  const GROUPE_COMPTE: LienSimple[] = [
    { href: "/equipe", label: t("nav_equipe"), menu: "EQUIPE" },
    { href: "/parametres", label: t("nav_parametres"), menu: "PARAMETRES" },
  ];

  const ENTREES: (LienSimple | GroupeNav)[] = [
    { href: "/caisse", label: t("nav_caisse"), menu: "CAISSE" },
    { href: "/tableau-de-bord", label: t("nav_tableauDeBord"), menu: "TABLEAU_DE_BORD" },
    { href: "/catalogue", label: t("nav_catalogue"), menu: "CATALOGUE" },
    { href: "/commandes", label: t("nav_commandes"), menu: "COMMANDES" },
    { groupeLabel: t("nav_finance"), liens: GROUPE_FINANCE },
    { href: "/livreurs", label: t("nav_livreurs"), menu: "LIVREURS" },
    { href: "/litiges", label: t("nav_litiges"), menu: "LITIGES" },
    { href: "/messagerie", label: t("nav_messagerie"), menu: "MESSAGERIE" },
    { groupeLabel: t("gshell_groupeCompte"), liens: GROUPE_COMPTE },
  ];

  // Mise à plat pour le repli par défaut ci-dessous — même liste qu'avant ce
  // regroupement, juste reconstituée depuis les groupes plutôt qu'un unique
  // tableau LIENS.
  const LIENS: LienSimple[] = ENTREES.flatMap((e) => (estGroupe(e) ? e.liens : [e]));

  // Filtre générique par écran accordé (remplace l'ancien cas particulier
  // unique réservé au comptable externe) — `currentShop.menuItems` vient de
  // GET /shops/mine, calculé côté API (ShopsService.ecransEffectifs) à
  // partir du rôle et d'un éventuel choix explicite du propriétaire/gérant.
  // Tant que la boutique n'a pas encore chargé, on affiche tout (rien
  // derrière ce menu n'est accessible sans la vraie barrière API de toute
  // façon) ; une fois chargée, la liste reçue fait foi, y compris vide.
  const ecransAutorises = currentShop?.menuItems ?? LIENS.map((l) => l.menu);

  return (
    <div className={styles.cadre}>
      {/* Enveloppe sticky (retour client du 12 nov. 2026 : "la fixation des
          en-têtes dans la plateforme lors du défilement ou navigation n'est
          toujours pas effective") — comme pour MarketplaceHeader, l'en-tête
          Gestion (bloc marque + barre d'onglets) défilait jusqu'ici avec le
          reste de la page au lieu de rester visible. */}
      <div className={styles.enveloppeFixe}>
        <header className={styles.entete}>
          <div className={styles.marqueBloc}>
            {/* Volet "passerelle entre modules" (demande du 13 nov. 2026 :
                "ajouter les 3 barres/volet vertical à tous les modules") —
                voir le commentaire détaillé dans AdminShell.tsx. */}
            <ModulesMenu />
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
            <CurrencySwitcher />
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
      </div>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="gestion" />
      <ChatWidget />
    </div>
  );
}
