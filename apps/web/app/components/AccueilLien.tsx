import Link from "next/link";
import styles from "./AccueilLien.module.css";

/**
 * Lien de retour vers la page d'accueil ELEGANZ ("/") — demande UX du
 * 15 oct. 2026, point 1 : jusqu'ici, sortir d'un module (Gestion, Centre de
 * pilotage, Secourable, Livreur, Marketplace) n'était possible qu'avec le
 * bouton retour du navigateur. Volontairement distinct du logo/nom du
 * module affiché à côté (qui reste le repère de "où je suis"), pour que ce
 * lien précis et son intention ("sortir d'ici") ne soient jamais ambigus.
 *
 * `etiquette` (21 nov. 2026, polissage des volets mobiles d'en-tête) : rend
 * le lien comme une ligne de menu pleine largeur, texte toujours visible,
 * sur la couleur de surface du thème — pour s'intégrer au volet "options"
 * repliable de chaque coquille (fond clair/sombre selon le thème, jamais
 * le fond sombre fixe de la barre d'en-tête). Sans ce prop, comportement
 * strictement inchangé (icône + texte sur fond sombre fixe de l'en-tête).
 */
export function AccueilLien({ etiquette }: { etiquette?: boolean } = {}) {
  return (
    <Link
      href="/"
      className={etiquette ? styles.lienEtiquette : styles.lien}
      title="Retour à la page d'accueil ELEGANZ"
      aria-label="Retour à la page d'accueil ELEGANZ"
    >
      <span aria-hidden="true">←</span>
      <span className={etiquette ? undefined : styles.texte}>Accueil</span>
    </Link>
  );
}
