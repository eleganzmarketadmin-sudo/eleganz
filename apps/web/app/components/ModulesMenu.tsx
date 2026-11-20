"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "./Logo";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./ModulesMenu.module.css";

/**
 * Volet "passerelle entre modules" (retour client du 12 nov. 2026, point 3)
 * — avant cet ajout, une fois entré dans un module (Marketplace surtout,
 * devenue la page d'atterrissage de fait pour un visiteur déjà venu une
 * fois, voir MarqueurVisiteMarketplace), il n'y avait plus aucun moyen de
 * découvrir les autres (Gestion, Mon assistant, Experts) sans revenir à
 * l'accueil "/" au hasard. Reprend les mêmes questions d'orientation que la
 * section #outils de l'accueil (page.tsx) — jamais un nom de module à nu —
 * pour que ce volet reste la même porte d'entrée, accessible depuis
 * n'importe quel en-tête public (SiteHeader, MarketplaceHeader).
 *
 * Bouton "3 barres" classique (façon Outlook/Gmail) plutôt qu'un emoji ☰,
 * pour un rendu net dans les deux thèmes sans dépendre de la police système
 * d'une plateforme à l'autre.
 */
export function ModulesMenu() {
  const { t } = useLocale();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", surEchap);
    const styleOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surEchap);
      document.body.style.overflow = styleOriginal;
    };
  }, [ouvert]);

  function fermer() {
    setOuvert(false);
  }

  return (
    <>
      <button
        type="button"
        className={styles.bouton}
        onClick={() => setOuvert(true)}
        aria-label={t("menuModules_ouvrir")}
        aria-expanded={ouvert}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div className={`${styles.fond} ${ouvert ? styles.fondVisible : ""}`} onClick={fermer} aria-hidden="true" />

      <aside className={`${styles.volet} ${ouvert ? styles.voletOuvert : ""}`} aria-hidden={!ouvert}>
        <div className={styles.enteteVolet}>
          <span className={styles.marqueVolet}>
            <LogoMark size={24} />
            ELEGANZ
          </span>
          <button
            type="button"
            className={styles.boutonFermer}
            onClick={fermer}
            aria-label={t("menuModules_fermer")}
          >
            ✕
          </button>
        </div>

        <nav className={styles.contenuVolet} aria-label={t("menuModules_titre")}>
          <Link href="/" className={styles.lienAccueil} onClick={fermer}>
            {t("nav_accueil")}
          </Link>

          <p className={styles.titreSection}>{t("menuModules_titre")}</p>

          <div className={`${styles.carteModule} ${styles.gestion}`}>
            <p className={styles.question}>{t("accueil_questionGestion")}</p>
            <Link href="/connexion" className={styles.lienModule} onClick={fermer}>
              {t("accueil_ouvrirCaisse")}
            </Link>
          </div>

          <div className={`${styles.carteModule} ${styles.marketplace}`}>
            <p className={styles.question}>{t("accueil_questionMarket")}</p>
            <Link href="/marketplace" className={styles.lienModule} onClick={fermer}>
              {t("accueil_parcourirVitrine")}
            </Link>
          </div>

          <div className={`${styles.carteModule} ${styles.comptable}`}>
            <p className={styles.question}>{t("accueil_questionComptable")}</p>
            <Link href="/comptable" className={styles.lienModule} onClick={fermer}>
              {t("accueil_ouvrirCarnet")}
            </Link>
          </div>

          <div className={`${styles.carteModule} ${styles.experts}`}>
            <p className={styles.question}>{t("accueil_questionExperts")}</p>
            <Link href="/marketplace/experts" className={styles.lienModule} onClick={fermer}>
              {t("accueil_trouverUnExpert")}
            </Link>
            {/* Second CTA (retour client du 12 nov. 2026) — le volet doit
                aussi parler à qui veut proposer son expertise, pas
                seulement à qui en cherche une. */}
            <Link href="/marketplace/experts/postuler" className={styles.lienModuleSecondaire} onClick={fermer}>
              {t("experts_devenirExpert")}
            </Link>
          </div>

          {/* Portail institutions financières (14 nov. 2026, demande :
              "rajouter dans le volet vertical de navigation le lien... qui
              va conduire à l'espace institution financières") — à la suite
              des quatre modules en libre accès, car ce portail reste sur
              invitation ELEGANZ uniquement (voir schema.prisma::Institution) :
              ce lien aide une institution déjà partenaire à retrouver sa
              connexion, jamais une inscription libre. */}
          <div className={`${styles.carteModule} ${styles.institution}`}>
            <p className={styles.question}>{t("accueil_questionInstitution")}</p>
            <Link href="/institution/connexion" className={styles.lienModule} onClick={fermer}>
              {t("accueil_ouvrirPortailInstitution")}
            </Link>
          </div>

          {/* Centre de pilotage (14 nov. 2026, demande : "ajouter le module
              admin aux options disponibles du volet vertical") — même
              principe que le lien institutions juste au-dessus : une carte
              de plus dans ce volet ne donne aucun accès nouveau, la vraie
              barrière reste le contrôle de rôle côté connexion/API
              (AuthService.login avec espace="admin"), exactement comme un
              visiteur qui tape /admin/connexion directement aujourd'hui. */}
          <div className={`${styles.carteModule} ${styles.admin}`}>
            <p className={styles.question}>{t("accueil_questionAdmin")}</p>
            <Link href="/admin/connexion" className={styles.lienModule} onClick={fermer}>
              {t("accueil_ouvrirCentrePilotage")}
            </Link>
          </div>

          {/* Portail livreur (20 nov. 2026, réouverture du réseau de
              livreurs ELEGANZ) — jusqu'ici seulement atteignable en tapant
              l'URL à la main, ce qui le rendait invisible pour un livreur
              potentiel venant du site public. Lien primaire vers
              l'inscription (acquisition de nouveaux livreurs, l'objectif de
              la réouverture), secondaire vers la connexion pour un livreur
              déjà inscrit — même construction que la carte Experts
              ci-dessus (chercher/devenir). */}
          <div className={`${styles.carteModule} ${styles.livreur}`}>
            <p className={styles.question}>{t("accueil_questionLivreur")}</p>
            <Link href="/livreur/inscription" className={styles.lienModule} onClick={fermer}>
              {t("accueil_devenirLivreur")}
            </Link>
            <Link href="/livreur/connexion" className={styles.lienModuleSecondaire} onClick={fermer}>
              {t("accueil_connexionLivreur")}
            </Link>
          </div>

          <div className={styles.separateur} />

          <Link href="/aide" className={styles.lienBas} onClick={fermer}>
            {t("nav_faq")}
          </Link>
          <Link href="/a-propos" className={styles.lienBas} onClick={fermer}>
            {t("nav_aPropos")}
          </Link>
        </nav>
      </aside>
    </>
  );
}
