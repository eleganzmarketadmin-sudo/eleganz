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
 * Second signalement, même jour : "les notifications dépliées débordent
 * l'écran" — cette fois verticalement. Le panneau (en-tête + invite push +
 * liste + lien "voir tout") peut dépasser le bas de l'écran selon la
 * position du bouton au moment de l'ouverture (page faite défiler, etc.).
 * Plutôt que de deviner une hauteur fixe, on plafonne la hauteur du panneau
 * à l'espace réellement disponible sous son point d'ancrage et on bascule
 * son propre défilement interne — jamais le reste de la page qui déborde.
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
    const parent = element.parentElement;
    // Réinitialise à l'ancrage par défaut posé par le CSS du module (right:
    // 0, top: calc(100% + …)) avant de mesurer, au cas où une ouverture
    // précédente avait appliqué un des replis ci-dessous.
    element.style.removeProperty("left");
    element.style.removeProperty("right");
    element.style.removeProperty("top");
    element.style.removeProperty("bottom");
    element.style.removeProperty("margin-bottom");
    element.style.removeProperty("max-height");
    element.style.removeProperty("overflow-y");

    const rect = element.getBoundingClientRect();
    if (rect.left < margeMinimale) {
      element.style.right = "auto";
      element.style.left = `${margeMinimale}px`;
    }

    if (!parent) return;
    // L'espace dispo se mesure depuis le bouton déclencheur (le parent
    // positionné), pas depuis le panneau lui-même : une fois celui-ci
    // basculé vers le haut, son propre rect ne veut plus rien dire tant
    // qu'on n'a pas déjà choisi le sens d'ouverture.
    const parentRect = parent.getBoundingClientRect();
    const espaceBas = window.innerHeight - parentRect.bottom - margeMinimale;
    const espaceHaut = parentRect.top - margeMinimale;
    const hauteurSouhaitee = rect.height;

    if (hauteurSouhaitee > espaceBas) {
      if (espaceHaut > espaceBas) {
        // Plus de place au-dessus du bouton qu'en dessous (ex. bouton
        // ouvert près du bas de l'écran) : on ouvre vers le haut plutôt que
        // de laisser le panneau se faire couper par le bas de l'écran.
        element.style.top = "auto";
        element.style.bottom = "100%";
        element.style.marginBottom = "8px";
        if (hauteurSouhaitee > espaceHaut && espaceHaut > 80) {
          element.style.maxHeight = `${espaceHaut}px`;
          element.style.overflowY = "auto";
        }
      } else if (espaceBas > 80) {
        element.style.maxHeight = `${espaceBas}px`;
        element.style.overflowY = "auto";
      }
      // Si ni l'un ni l'autre sens n'offre assez de place (micro-écran en
      // paysage, etc.), on laisse tel quel plutôt que d'écraser le panneau
      // à une hauteur inutilisable — mieux vaut un défilement de page
      // qu'un contenu totalement illisible.
    }
  }, [ouvert, ref, margeMinimale]);
}
