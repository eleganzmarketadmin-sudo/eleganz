"use client";

import { useEffect, type RefObject } from "react";

/**
 * Signalement du 10 nov. 2026, point 3 : "la barre de menu ne reste pas
 * bloquée sur la partie du menu cliqué ou sélectionné ; elle rentre à
 * chaque fois au début de la barre de menus même lorsque c'est le dernier
 * menu qui est sélectionné."
 *
 * Cause réelle : chaque écran (GestionShell/AdminShell/LivreurShell/
 * ComptableShell) enveloppe lui-même son contenu dans sa coquille plutôt
 * que de la poser une fois dans un layout partagé (voir ProtectedGestionPage
 * et équivalents) — à chaque navigation, React démonte entièrement la page
 * précédente et remonte une page neuve, donc une toute nouvelle barre
 * <nav>, qui reprend son défilement horizontal à zéro même quand l'onglet
 * actif est le dernier de la barre.
 *
 * Réorganiser l'arborescence des layouts pour que la barre persiste
 * réellement serait le correctif le plus propre, mais c'est un chantier
 * plus large à risque élevé sur les quatre espaces authentifiés. Ici, on
 * fait rentrer l'onglet actif dans le champ visible dès le montage de la
 * barre — sans défilement animé (comportement navigateur par défaut,
 * instantané), pour que ce soit imperceptible et jamais un second
 * mouvement après l'affichage de la page.
 */
export function useScrollNavActifEnVue(navRef: RefObject<HTMLElement | null>, activeHref: string) {
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const lienActif = nav.querySelector<HTMLElement>('[data-nav-actif="true"]');
    if (!lienActif) return;
    lienActif.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [navRef, activeHref]);
}
