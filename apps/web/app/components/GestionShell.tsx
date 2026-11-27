"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
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
  // Statistiques rejoint le groupe Finance (27 nov. 2026, retour
  // propriétaire : "la barre de menu ... déborde ... le menu statistiques
  // des ventes mettez ça dans finances avec les rapports d'activités") —
  // même clé de permission STATISTIQUES qu'avant, seul son emplacement dans
  // la barre change (repli automatique en lien simple si c'est le seul
  // écran Finance/Statistiques accordé à ce rôle, voir le rendu plus bas).
  const GROUPE_FINANCE: LienSimple[] = [
    { href: "/statistiques", label: t("nav_statistiques"), menu: "STATISTIQUES" },
    { href: "/factures", label: t("nav_mesFactures"), menu: "FACTURES" },
    { href: "/releves", label: t("nav_releves"), menu: "RELEVES" },
    { href: "/finance", label: t("nav_finance"), menu: "FINANCE" },
  ];
  // Boost + Boost 360° fusionnés en un seul menu déroulant (27 nov. 2026,
  // même retour propriétaire que ci-dessus : "les 2 menus boost les
  // regrouper en un seul (avec les deux sous menus : boost eleganz et boost
  // 360)") — les deux restent sur le même écran de permission BOOST, donc
  // toujours visibles/masqués ensemble (jamais un seul des deux visible,
  // voir le filtre par `menu` plus bas), le repli en lien simple ne peut
  // donc jamais se produire ici en pratique.
  const GROUPE_BOOST: LienSimple[] = [
    { href: "/boost", label: t("nav_boostEleganz"), menu: "BOOST" },
    { href: "/boost-360", label: t("nav_boost360"), menu: "BOOST" },
  ];
  const GROUPE_COMPTE: LienSimple[] = [
    { href: "/equipe", label: t("nav_equipe"), menu: "EQUIPE" },
    { href: "/parametres", label: t("nav_parametres"), menu: "PARAMETRES" },
  ];

  const ENTREES: (LienSimple | GroupeNav)[] = [
    { href: "/caisse", label: t("nav_caisse"), menu: "CAISSE" },
    { href: "/tableau-de-bord", label: t("nav_tableauDeBord"), menu: "TABLEAU_DE_BORD" },
    { href: "/catalogue", label: t("nav_catalogue"), menu: "CATALOGUE" },
    { groupeLabel: t("nav_boost"), liens: GROUPE_BOOST },
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

  // Repli de la barre d'onglets sur téléphone (21 nov. 2026, retour client :
  // "l'entête et les menus occupent la moitié de l'écran ... dérouler les
  // menus (trois barres horizontales juste en dessous de la ligne logo +
  // Eleganz)") — repliée par défaut sous le point de rupture mobile (voir
  // .nav/.navOuvert dans GestionShell.module.css), dépliée via le bouton
  // juste au-dessus d'elle. <nav> reste toujours monté (navigation au
  // clavier/lecteur d'écran intacte) : seul l'affichage change, jamais une
  // boîte `overflow` (voir l'historique sur .nav plus bas — romprait les
  // panneaux de DropdownNavGroup).
  const [navOuvert, setNavOuvert] = useState(false);

  // Repli automatique dès que la page change — qu'on vienne d'un lien simple
  // ou d'un enfant de groupe déroulant (DropdownNavGroup gère déjà la
  // fermeture de SON propre panneau ; ceci referme en plus la barre entière).
  useEffect(() => {
    setNavOuvert(false);
  }, [pathname]);

  // Échap referme aussi le volet, même sans avoir changé de page — même
  // convention que ModulesMenu/DropdownNavGroup ci-dessus.
  useEffect(() => {
    if (!navOuvert) return;
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOuvert(false);
    }
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [navOuvert]);

  // Libellé affiché sur le bouton replié : la section où on se trouve déjà,
  // plutôt qu'un mot générique "Menu" sans repère — utile puisque la barre
  // entière reste masquée tant qu'on ne l'ouvre pas.
  const lienActif = LIENS.find((l) => pathname === l.href || pathname?.startsWith(`${l.href}/`));
  const libelleNavMobile = lienActif?.label ?? t("gshell_menu");

  // Repli du bloc "options" (notifications, langue, devise, thème,
  // déconnexion, etc.) sur téléphone (21 nov. 2026, retour client : "en
  // regroupant sous barre déroulante ou flèche au coin droit toutes les
  // options") — même principe que navOuvert ci-dessus : <div className=
  // {styles.droite}> reste toujours montée, seul son affichage change sous
  // le point de rupture mobile (voir .droite/.droiteOuvert). Chacun des
  // composants qu'elle contient (NotificationBell, LanguageSwitcher...) gère
  // déjà son propre panneau déroulant indépendamment — rien ici ne les
  // modifie, ce volet ne fait que les regrouper visuellement.
  const [optionsOuvert, setOptionsOuvert] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Repli automatique au changement de page — même raison que pour navOuvert
  // (ex. après un clic sur "Accueil" ou "Se déconnecter" qui navigue).
  useEffect(() => {
    setOptionsOuvert(false);
  }, [pathname]);

  // Échap, et clic en dehors du bloc — même convention que
  // ModulesMenu/DropdownNavGroup/NotificationBell.
  useEffect(() => {
    if (!optionsOuvert) return;
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOptionsOuvert(false);
    }
    function surClicExterieur(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOuvert(false);
      }
    }
    document.addEventListener("keydown", surEchap);
    document.addEventListener("mousedown", surClicExterieur);
    return () => {
      document.removeEventListener("keydown", surEchap);
      document.removeEventListener("mousedown", surClicExterieur);
    };
  }, [optionsOuvert]);

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
          <div className={styles.optionsBloc} ref={optionsRef}>
            {/* 25 nov. 2026, retour propriétaire : "sortir la cloche de
                notification des 3 points ... et la garder toujours
                visible" — la cloche vivait jusqu'ici À L'INTÉRIEUR du
                volet "options" replié (voir .droite/.droiteOuvert
                ci-dessous), donc invisible sur téléphone tant qu'on ne
                l'ouvrait pas (un badge sur le bouton "⋮" relayait le
                compteur, en pis-aller). Elle est maintenant montée ICI,
                hors du volet, toujours visible quelle que soit la largeur
                d'écran — même traitement que le panier sur la Marketplace,
                jamais caché derrière un repli. Une seule instance (pas de
                doublon dans le volet) : NotificationBell gère déjà son
                propre sondage et son propre panneau déroulant. */}
            <NotificationBell />
            {/* Bouton de repli du bloc options, téléphone uniquement (voir
                .boutonOptionsMobile) — distinct du bouton ☰ de la barre
                d'onglets plus bas : celui-ci replie l'autre moitié de
                l'en-tête (langue, devise, thème, déconnexion...). */}
            <button
              type="button"
              className={styles.boutonOptionsMobile}
              onClick={() => {
                setOptionsOuvert((v) => !v);
                setNavOuvert(false);
              }}
              aria-expanded={optionsOuvert}
              aria-controls="gestion-options"
              aria-label={t("gshell_options")}
              title={t("gshell_options")}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            <div id="gestion-options" className={`${styles.droite} ${optionsOuvert ? styles.droiteOuvert : ""}`}>
              <AccueilLien etiquette />
              {nombreEnAttente > 0 && (
                <button onClick={synchroniser} title={t("horsLigne_cliquerSynchroniser")} className={styles.ligneSync}>
                  {nombreEnAttente} vente(s) en attente de synchronisation
                </button>
              )}
              {shops.length > 1 && (
                <div className={styles.ligneChamp}>
                  <span className={styles.etiquetteChamp}>{t("gshell_boutique")}</span>
                  <select
                    aria-label="Choisir la boutique"
                    value={currentShop?.id ?? ""}
                    onChange={(e) => setCurrentShopId(e.target.value)}
                    className={styles.selectPleine}
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  setOptionsOuvert(false);
                  logout();
                  router.push("/");
                }}
              >
                {t("action_seDeconnecter")}
              </button>
            </div>
          </div>
        </header>
        <BandeMarque couleur="var(--color-cobalt-sur-fonce)" />
        {/* Bouton replier/déplier, visible uniquement sur téléphone (voir
            .boutonNavMobile dans GestionShell.module.css) — distinct de
            <ModulesMenu /> ci-dessus (passerelle ENTRE modules) : celui-ci ne
            replie que la barre d'onglets DU module en cours. */}
        <button
          type="button"
          className={styles.boutonNavMobile}
          onClick={() => {
            setNavOuvert((v) => !v);
            setOptionsOuvert(false);
          }}
          aria-expanded={navOuvert}
          aria-controls="gestion-nav"
        >
          <span aria-hidden="true" className={styles.boutonNavMobileBarres}>
            ☰
          </span>
          <span className={styles.boutonNavMobileLabel}>{libelleNavMobile}</span>
          <span aria-hidden="true" className={styles.boutonNavMobileChevron}>
            {navOuvert ? "▴" : "▾"}
          </span>
        </button>
        <nav id="gestion-nav" className={`${styles.nav} ${navOuvert ? styles.navOuvert : ""}`} ref={navRef}>
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
                  title={entree.label}
                  onClick={() => setNavOuvert(false)}
                >
                  <span className={styles.libelleNav}>{entree.label}</span>
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
                  title={seul.label}
                  onClick={() => setNavOuvert(false)}
                >
                  <span className={styles.libelleNav}>{seul.label}</span>
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
