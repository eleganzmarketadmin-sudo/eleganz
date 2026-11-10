"use client";

import { useEffect, type RefObject } from "react";

/**
 * Signalement du 10 nov. 2026 : un menu déroulant positionné en CSS avec
 * `right: 0` (ancré au bord droit de son propre bouton déclencheur) déborde
 * du bord GAUCHE de l'écran quand ce bouton se retrouve, à cause du retour
 * à la ligne du header sur mobile, trop près du bord gauche pour que la
 * largeur du menu tienne entre les deux (texte coupé, illisible). Plutôt
 * que de réancrer tous les menus en dur, cette aide mesure la position
 * réelle une fois le menu ouvert et, si elle déborderait, le ré-ancre à une
 * marge fixe du bord de l'écran au lieu du bouton.
 *
 * Partagée entre tous les menus déroulants concernés (cloche de
 * notifications, menu "Mon compte", etc.) pour que le correctif ne soit
 * écrit qu'une seule fois.
 */
export function useClampDropdownADroite(ref: RefObject<HTMLElement | null>, ouvert: boolean, margeMinimale = 12) {
  useEffect(() => {
    if (!ouvert) return;
    const element = ref.current;
    if (!element) return;
    // Réinitialise à l'ancrage par défaut (right: 0, posé par le CSS du
    // module) avant de mesurer, au cas où une ouverture précédente avait
    // appliqué le repli ci-dessous.
    element.style.removeProperty("left");
    element.style.removeProperty("right");
    const rect = element.getBoundingClientRect();
    if (rect.left < margeMinimale) {
      element.style.right = "auto";
      element.style.left = `${margeMinimale}px`;
    }
  }, [ouvert, ref, margeMinimale]);
}
