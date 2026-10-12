"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anime un nombre de 0 vers sa valeur finale à l'affichage — un seul
 * mouvement au chargement, jamais répété ensuite. Respecte
 * prefers-reduced-motion en affichant directement la valeur finale.
 */
export function CompteurAnime({
  valeur,
  formater = (n: number) => Math.round(n).toLocaleString("fr-FR"),
  dureeMs = 700,
}: {
  valeur: number;
  formater?: (n: number) => string;
  dureeMs?: number;
}) {
  const [affiche, setAffiche] = useState(0);
  const depart = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAffiche(valeur);
      return;
    }
    depart.current = null;
    let frame: number;
    function pas(horodatage: number) {
      if (depart.current === null) depart.current = horodatage;
      const progres = Math.min(1, (horodatage - depart.current) / dureeMs);
      const allege = 1 - (1 - progres) * (1 - progres); // ease-out quad
      setAffiche(valeur * allege);
      if (progres < 1) {
        frame = requestAnimationFrame(pas);
      } else {
        setAffiche(valeur);
      }
    }
    frame = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return <>{formater(affiche)}</>;
}
