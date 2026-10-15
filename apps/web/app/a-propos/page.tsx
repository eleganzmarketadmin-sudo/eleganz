import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import { Footer } from "../components/Footer";
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
  return (
    <div className={styles.page}>
      <SiteHeader />

      <section className={styles.hero}>
        <h1>Une maison, trois pièces</h1>
        <p>
          ELEGANZ est un écosystème pensé pour le commerce congolais, du petit
          vendeur informel à la boutique installée : tenir ses comptes, gérer
          une boutique et vendre en ligne — trois outils séparés, une seule
          plateforme, construite et exploitée depuis Kinshasa. La livraison,
          elle, reste pour l&apos;instant organisée par chaque boutique avec
          ses propres livreurs, sous sa propre responsabilité.
        </p>
      </section>

      <section className={styles.modules}>
        <div className={`${styles.carte} ${styles.comptable}`}>
          <h2>ELEGANZ Mon Comptable</h2>
          <p>
            Un carnet de gestion quotidien pour toute activité — commerce,
            location, service, véhicule — sans boutique ni catalogue à créer.
            Ventes et dépenses par devise, dettes et créances avec règlement
            partiel, gestion locative, versements des travailleurs, agenda des
            échéances, graphiques et synthèses exportables, et un dossier
            préparatoire pour une demande de financement. Six mois gratuits,
            puis 1 $ par mois.
          </p>
          <Link href="/comptable">Ouvrir mon carnet</Link>
        </div>

        <div className={`${styles.carte} ${styles.gestion}`}>
          <h2>ELEGANZ Gestion</h2>
          <p>
            La caisse, le stock et les factures d&apos;une boutique, avec prix
            négocié à l&apos;encaissement, import/export Excel du catalogue,
            relevés d&apos;activité certifiés, suivi des commandes et des
            litiges, gestion d&apos;équipe, et un mode hors-ligne qui protège
            chaque vente même en cas de coupure réseau.
          </p>
          <Link href="/connexion">Ouvrir ma caisse</Link>
        </div>

        <div className={`${styles.carte} ${styles.marketplace}`}>
          <h2 className="titre-vitrine">ELEGANZ Market</h2>
          <p>
            Porter la couleur : la vitrine qui réunit les boutiques ELEGANZ
            dans un même marché en ligne. Recherche, fiche produit, panier,
            commande, suivi de livraison et avis clients, pour acheter
            congolais sans sortir de chez soi.
          </p>
          <Link href="/marketplace">Parcourir la vitrine</Link>
        </div>
      </section>

      <section className={styles.engagement}>
        <h2>Ce que nous ne faisons pas</h2>
        <p>
          Aucun document émis sur ELEGANZ n&apos;est présenté comme une
          facture fiscale homologuée tant que l&apos;homologation officielle
          n&apos;est pas confirmée : chaque boutique choisit, au cas par cas,
          entre un document commercial ordinaire et une facture fiscale,
          jamais l&apos;un pour l&apos;autre. Et aucun paiement en ligne
          n&apos;est aujourd&apos;hui présenté comme confirmé — le règlement
          des commandes se fait à la livraison, en espèces ou en mobile
          money, en toute transparence.
        </p>
      </section>

      <Footer variante="accueil" />
    </div>
  );
}
