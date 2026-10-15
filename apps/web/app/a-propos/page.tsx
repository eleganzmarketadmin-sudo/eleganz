"use client";

import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import { Footer } from "../components/Footer";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

/**
 * Page "À propos d'ELEGANZ" (demande du 13 oct. 2026, point 2 : le pied de
 * page n'avait pas de section "à propos" — ce lien y mène maintenant depuis
 * tous les espaces). Présente les modules réels de la plateforme ouverts au
 * public, sans survendre : chaque description reprend ce qui existe
 * réellement (voir docs/PROJECT_STATUS.md), rien d'inventé ni de prématuré.
 * ELEGANZ Livreur (réseau ouvert à tout le monde) n'est volontairement pas
 * listé ici depuis le 13 oct. 2026 — inscription fermée, voir
 * livreur/inscription/page.tsx et delivery.service.ts.
 */
export default function AProposPage() {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <SiteHeader />

      <section className={styles.hero}>
        <h1>{t("apropos_h1")}</h1>
        <p>{t("apropos_intro")}</p>
      </section>

      <section className={styles.modules}>
        <div className={`${styles.carte} ${styles.comptable}`}>
          <h2>ELEGANZ {t("titre_accueil")}</h2>
          <p>{t("apropos_descComptable")}</p>
          <Link href="/comptable">{t("accueil_ouvrirCarnet")}</Link>
        </div>

        <div className={`${styles.carte} ${styles.gestion}`}>
          <h2>ELEGANZ {t("nom_gestion")}</h2>
          <p>{t("apropos_descGestion")}</p>
          <Link href="/connexion">{t("accueil_ouvrirCaisse")}</Link>
        </div>

        <div className={`${styles.carte} ${styles.marketplace}`}>
          <h2 className="titre-vitrine">ELEGANZ {t("nom_market")}</h2>
          <p>{t("apropos_descMarket")}</p>
          <Link href="/marketplace">{t("accueil_parcourirVitrine")}</Link>
        </div>
      </section>

      <section className={styles.engagement}>
        <h2>{t("apropos_h2Engagement")}</h2>
        <p>{t("apropos_texteEngagement")}</p>
      </section>

      <Footer variante="accueil" />
    </div>
  );
}
