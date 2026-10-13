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
        <div className={`${styles.bloc} ${styles.gestion}`}>
          <h1>ELEGANZ Gestion</h1>
          <p>
            La caisse, le stock et les comptes de votre boutique à Kinshasa — du
            comptoir jusqu&apos;au tableau de bord du soir.
          </p>
          <Link className={styles.lien} href="/connexion">
            Ouvrir ma caisse
          </Link>
        </div>
        <div className={`${styles.bloc} ${styles.marketplace}`}>
          <h1 className="titre-vitrine">Porter la couleur</h1>
          <p>La mode et le luxe congolais, choisis chez des boutiques d&apos;ici.</p>
          <Link className={styles.lien} href="/marketplace">
            Parcourir la vitrine
          </Link>
        </div>
        <div className={`${styles.bloc} ${styles.livreur}`}>
          <h1>ELEGANZ Livreur</h1>
          <p>
            Recevez des missions de livraison pour les boutiques ELEGANZ de
            votre commune, de l&apos;enlèvement jusqu&apos;à la remise.
          </p>
          <Link className={styles.lien} href="/livreur/inscription">
            Devenir livreur
          </Link>
        </div>
      </div>
      <Footer variante="accueil" />
    </div>
  );
}
