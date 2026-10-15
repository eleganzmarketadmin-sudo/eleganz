import Link from "next/link";
import styles from "./AccueilLien.module.css";

/**
 * Lien de retour vers la page d'accueil ELEGANZ ("/") — demande UX du
 * 15 oct. 2026, point 1 : jusqu'ici, sortir d'un module (Gestion, Centre de
 * pilotage, Secourable, Livreur, Marketplace) n'était possible qu'avec le
 * bouton retour du navigateur. Volontairement distinct du logo/nom du
 * module affiché à côté (qui reste le repère de "où je suis"), pour que ce
 * lien précis et son intention ("sortir d'ici") ne soient jamais ambigus.
 */
export function AccueilLien() {
  return (
    <Link href="/" className={styles.lien} title="Retour à la page d'accueil ELEGANZ">
      <span aria-hidden="true">←</span> Accueil
    </Link>
  );
}
