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
          <h1>Le commerce congolais, du comptoir à la vitrine</h1>
          <p>
            ELEGANZ est un écosystème pensé pour les commerçants et indépendants de Kinshasa : tenir ses
            comptes, gérer une boutique et vendre en ligne — trois outils séparés, une seule plateforme,
            construite et exploitée depuis la RDC.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.lienPrincipal} href="#outils">
              Choisir mon outil
            </a>
            <Link className={styles.lienSecondaire} href="/a-propos">
              À propos d&apos;ELEGANZ
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
        <h2>Quel outil vous correspond ?</h2>
        <p className={styles.outilsIntro}>
          Pas besoin de connaître la plateforme à l&apos;avance : répondez à la question qui vous
          concerne.
        </p>
        <div className={styles.grille}>
          <div className={`${styles.carte} ${styles.comptable}`}>
            <h3>Vous tenez une activité, sans boutique ni catalogue ?</h3>
            <p>
              <strong>ELEGANZ {t("titre_accueil")}</strong> — ventes et dépenses par devise, dettes et
              créances, loyers, versements des travailleurs, agenda des échéances et synthèses
              exportables. Six mois gratuits, puis 1 $ par mois.
            </p>
            <Link className={styles.lienCarte} href="/comptable">
              Ouvrir mon carnet
            </Link>
          </div>

          <div className={`${styles.carte} ${styles.gestion}`}>
            <h3>Vous avez une boutique, avec caisse et stock à gérer ?</h3>
            <p>
              <strong>ELEGANZ {t("nom_gestion")}</strong> — la caisse, le stock, les factures et les commandes de
              votre boutique, avec livraison suivie et équipe intégrée, du comptoir jusqu&apos;au
              tableau de bord du soir.
            </p>
            <Link className={styles.lienCarte} href="/connexion">
              Ouvrir ma caisse
            </Link>
          </div>

          <div className={`${styles.carte} ${styles.marketplace}`}>
            <h3>Vous cherchez à acheter ou vendre en ligne ?</h3>
            <p>
              <strong className="titre-vitrine">ELEGANZ {t("nom_market")}</strong> — la vitrine qui réunit
              vendeurs et acheteurs congolais, tous secteurs confondus : recherche, commande et
              livraison suivie, où que vous soyez.
            </p>
            <Link className={styles.lienCarte} href="/marketplace">
              Parcourir la vitrine
            </Link>
          </div>
        </div>
      </section>

      <Footer variante="accueil" />
    </div>
  );
}
