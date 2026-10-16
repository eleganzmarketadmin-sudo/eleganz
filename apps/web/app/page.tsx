"use client";

import Link from "next/link";
import { SiteHeader } from "./components/SiteHeader";
import { Footer } from "./components/Footer";
import { useLocale } from "./lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Refonte du 15 oct. 2026 (demande UX, point 1) : l'ancienne page montrait
// trois blocs plein écran, un par module, sans barre de menu ni phrase de
// présentation globale — il fallait déjà savoir laquelle des trois portes
// ouvrir avant même d'arriver. Ici, un seul message d'ensemble d'abord
// ("qu'est-ce qu'ELEGANZ"), puis une section d'orientation qui pose la
// question dans les mots du visiteur ("vous avez une boutique ?") plutôt que
// de nommer directement un produit — à la manière d'un portail Odoo, qui
// présente la suite avant de pousser vers une app précise.
export default function HomePage() {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroTexte}>
          <h1>{t("accueil_h1")}</h1>
          <p>{t("accueil_heroTexte")}</p>
          <div className={styles.heroActions}>
            <a className={styles.lienPrincipal} href="#outils">
              {t("accueil_choisirOutil")}
            </a>
            <Link className={styles.lienSecondaire} href="/a-propos">
              {t("accueil_aProposLien")}
            </Link>
          </div>
        </div>
        <div className={styles.heroMotif} aria-hidden="true">
          <span className={styles.piece} style={{ background: "var(--color-cobalt)" }} />
          <span className={styles.piece} style={{ background: "var(--color-flamme)" }} />
          <span className={styles.piece} style={{ background: "var(--color-or)" }} />
          <span className={styles.piece} style={{ background: "var(--color-magenta)" }} />
        </div>
      </section>

      <section className={styles.outils} id="outils">
        <h2>{t("accueil_h2Outils")}</h2>
        <p className={styles.outilsIntro}>{t("accueil_outilsIntro")}</p>
        <div className={styles.grille}>
          <div className={`${styles.carte} ${styles.comptable}`}>
            <h3>{t("accueil_questionComptable")}</h3>
            <p>
              <strong>ELEGANZ {t("titre_accueil")}</strong> {t("accueil_descComptable")}
            </p>
            <Link className={styles.lienCarte} href="/comptable">
              {t("accueil_ouvrirCarnet")}
            </Link>
          </div>

          <div className={`${styles.carte} ${styles.gestion}`}>
            <h3>{t("accueil_questionGestion")}</h3>
            <p>
              <strong>ELEGANZ {t("nom_gestion")}</strong> {t("accueil_descGestion")}
            </p>
            <Link className={styles.lienCarte} href="/connexion">
              {t("accueil_ouvrirCaisse")}
            </Link>
          </div>

          <div className={`${styles.carte} ${styles.marketplace}`}>
            <h3>{t("accueil_questionMarket")}</h3>
            <p>
              <strong className="titre-vitrine">ELEGANZ {t("nom_market")}</strong> {t("accueil_descMarket")}
            </p>
            <Link className={styles.lienCarte} href="/marketplace">
              {t("accueil_parcourirVitrine")}
            </Link>
          </div>

          <div className={`${styles.carte} ${styles.experts}`}>
            <h3>{t("accueil_questionExperts")}</h3>
            <p>
              <strong>{t("accueil_trouverUnExpert")}</strong> {t("accueil_descExperts")}
            </p>
            <Link className={styles.lienCarte} href="/marketplace/experts">
              {t("accueil_trouverUnExpert")}
            </Link>
          </div>
        </div>
      </section>

      <Footer variante="accueil" />
    </div>
  );
}
