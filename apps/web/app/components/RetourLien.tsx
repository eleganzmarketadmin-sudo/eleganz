"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./RetourLien.module.css";

/**
 * Bouton retour réutilisable (demande du 15 oct. 2026, point 6 — "s'assurer
 * des options retour en arrière dans tous les menus et sous options").
 *
 * `href` est TOUJOURS fourni par l'appelant : c'est la page parente connue
 * (jamais devinée), utilisée quand il n'y a pas d'historique de navigation
 * dans l'app à remonter (lien direct, onglet rouvert, retour hors-ligne
 * resynchronisé) — `router.back()` reste préféré quand il y a un
 * historique, pour rendre à l'utilisateur l'état exact qu'il avait quitté
 * (filtres, pagination), ce qu'un lien statique vers la page parente ne
 * peut pas garantir.
 */
export function RetourLien({ href, label = "Retour" }: { href: string; label?: string }) {
  const router = useRouter();

  function retourner(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <Link href={href} onClick={retourner} className={styles.lien}>
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}
