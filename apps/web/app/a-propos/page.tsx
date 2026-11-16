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
 *
 * Carré de marque à 4 couleurs ajouté le 16 nov. 2026 : "/" redirige
 * maintenant tout visiteur vers la Marketplace (voir middleware.ts), donc
 * cet ancien motif de l'accueil (Cobalt/Flamme/Or/Magenta, repris de
 * COULEURS_MARQUE dans Logo.tsx) n'apparaissait plus nulle part — il vit
 * désormais ici, dans le hero de cette page.
 *
 * Module Institution ajouté le 16 nov. 2026 (signalement : "vous avez
 * oublié les autres modules comme institution") — un partenaire financier
 * (microfinance, banque, coopérative) n'a pas de portail grand public comme
 * les trois autres (pas de lien dans SiteHeader, l'inscription se fait sur
 * invitation), mais mérite sa place ici au même titre que les autres
 * modules réels de la plateforme ; voir institution/inscription/page.tsx
 * pour le texte repris pour le lien de cette carte.
 */
export default function AProposPage() {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <SiteHeader />

      <section className={styles.hero}>
        <h1>{t("apropos_h1")}</h1>
        <p>{t("apropos_intro")}</p>
        <div className={styles.heroMotif} aria-hidden="true">
          <span className={styles.piece} style={{ background: "var(--color-cobalt)" }} />
          <span className={styles.piece} style={{ background: "var(--color-flamme)" }} />
          <span className={styles.piece} style={{ background: "var(--color-or)" }} />
          <span className={styles.piece} style={{ background: "var(--color-magenta)" }} />
        </div>
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

        <div className={`${styles.carte} ${styles.institution}`}>
          <h2>ELEGANZ {t("nav_institutions")}</h2>
          <p>{t("apropos_descInstitution")}</p>
          <Link href="/institution/inscription">{t("inst_inscription_titreMarque")}</Link>
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
