"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Comportement partagé des volets mobiles repliables d'un en-tête de portail
 * (21 nov. 2026 : repli de la barre d'onglets puis du bloc options sur
 * GestionShell, étalé le même jour à tous les autres portails — AdminShell,
 * ComptableShell, InstitutionShell, LivreurShell). Centralise ici ce qui
 * était jusque-là réécrit à la main dans chaque coquille : fermeture au
 * changement de page, à Échap, au clic en dehors, et exclusion mutuelle
 * entre deux volets (nav + options) d'un même en-tête pour ne jamais avoir
 * les deux ouverts à la fois.
 *
 * `pathname` est à passer explicitement (plutôt qu'appeler usePathname() ici)
 * pour que ce hook reste indépendant du routeur et réutilisable tel quel
 * dans n'importe quelle coquille, qui a de toute façon déjà pathname sous la
 * main pour son propre rendu de nav.
 */
export function useVoletRepliable(pathname: string | null, fermerAutre?: () => void) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Repli automatique dès que la page change — qu'on vienne d'un lien simple,
  // d'un enfant de groupe déroulant, ou d'une action du volet options
  // (Accueil, déconnexion...).
  useEffect(() => {
    setOuvert(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Échap, et clic en dehors du volet — même convention que
  // ModulesMenu/DropdownNavGroup/NotificationBell déjà dans ce code base.
  useEffect(() => {
    if (!ouvert) return;
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    function surClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("keydown", surEchap);
    document.addEventListener("mousedown", surClicExterieur);
    return () => {
      document.removeEventListener("keydown", surEchap);
      document.removeEventListener("mousedown", surClicExterieur);
    };
  }, [ouvert]);

  function basculer() {
    setOuvert((v) => !v);
    fermerAutre?.();
  }

  return { ouvert, setOuvert, ref: ref as RefObject<HTMLDivElement>, basculer };
}
