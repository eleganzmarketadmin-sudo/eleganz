import Link from "next/link";
import { LogoMark } from "./components/Logo";
import { Footer } from "./components/Footer";
import styles from "./page.module.css";

// Porte d'entrée de la maison ELEGANZ : deux pièces, deux publics. Le
// commerçant qui tient la caisse n'a rien à faire du côté vitrine, et
// l'acheteur qui vient chiner n'a pas besoin de voir un tableau de bord.
export default function HomePage() {
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.marqueFlottante}>
        <LogoMark size={26} />
        ELEGANZ
      </Link>
      <div className={styles.cadre}>
        <div className={`${styles.bloc} ${styles.comptable}`}>
          <h1>ELEGANZ Mon Comptable</h1>
          <p>
            Ventes et dépenses par devise, dettes et créances, loyers,
            versements des travailleurs, agenda des échéances et synthèses
            exportables — un carnet de gestion complet, sans boutique ni
            catalogue à créer.
          </p>
          <Link className={styles.lien} href="/comptable">
            Ouvrir mon carnet
          </Link>
        </div>
        <div className={`${styles.bloc} ${styles.gestion}`}>
          <h1>ELEGANZ Gestion</h1>
          <p>
            La caisse, le stock, les factures et les commandes de votre
            boutique à Kinshasa, avec livraison suivie et équipe intégrée —
            du comptoir jusqu&apos;au tableau de bord du soir.
          </p>
          <Link className={styles.lien} href="/connexion">
            Ouvrir ma caisse
          </Link>
        </div>
        <div className={`${styles.bloc} ${styles.marketplace}`}>
          <h1 className="titre-vitrine">ELEGANZ Market</h1>
          <p>
            Porter la couleur : la marketplace qui réunit les boutiques de
            mode et de luxe congolaises dans une seule vitrine — recherche,
            commande et livraison suivie à Kinshasa.
          </p>
          <Link className={styles.lien} href="/marketplace">
            Parcourir la vitrine
          </Link>
        </div>
      </div>
      <Footer variante="accueil" />
    </div>
  );
}
