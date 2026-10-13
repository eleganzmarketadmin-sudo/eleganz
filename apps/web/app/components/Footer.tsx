import Link from "next/link";
import { LogoMark, BandeMarque } from "./Logo";
import styles from "./Footer.module.css";

const TAGLINES: Record<"accueil" | "gestion" | "admin" | "marketplace" | "livreur", string> = {
  accueil: "Une maison, plusieurs pièces : la boutique, la vitrine et la route.",
  gestion: "La caisse et la boutique, tenues au carré.",
  admin: "La plateforme, supervisée en un coup d'œil.",
  marketplace: "La mode congolaise, du tissu au client.",
  livreur: "De l'enlèvement à la remise, mission par mission.",
};

/**
 * Pied de page commun aux quatre espaces (demande du 12 oct. 2026 — aucun
 * des sites n'en avait ; espace livreur ajouté le même jour). Volontairement
 * sobre : pas de fausses mentions légales ni d'adresse inventées, juste la
 * marque, un repère de navigation entre les espaces, et l'année — cohérent
 * avec le système de design (aplats pleins, aucune ombre, aucun angle
 * arrondi).
 */
export function Footer({
  variante,
}: {
  variante: "accueil" | "gestion" | "admin" | "marketplace" | "livreur";
}) {
  return (
    <footer className={styles.pied}>
      <BandeMarque />
      <div className={styles.contenu}>
        <div className={styles.bloc}>
          <div className={styles.marque}>
            <LogoMark size={22} />
            <span>ELEGANZ</span>
          </div>
          <p className={styles.slogan}>{TAGLINES[variante]}</p>
        </div>
        <nav className={styles.liens} aria-label="Autres espaces ELEGANZ">
          <Link href="/">Accueil</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/connexion">Gestion</Link>
          <Link href="/livreur/connexion">Livreur</Link>
          <Link href="/admin/connexion">Centre de pilotage</Link>
        </nav>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} ELEGANZ — République démocratique du Congo.
        </p>
      </div>
    </footer>
  );
}
