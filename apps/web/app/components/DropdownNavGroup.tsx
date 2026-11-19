"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./DropdownNavGroup.module.css";

interface LienEnfant {
  href: string;
  label: string;
}

/**
 * Groupe déroulant pour les barres de navigation à onglets (19 nov. 2026,
 * demande du propriétaire : "créer des options navigables au sein de ses
 * menus ... au lieu de défiler sur une longue page interminable des listes
 * d'options" — la barre admin comptait 19 onglets à plat qui débordaient
 * horizontalement, le sous-menu Finance 14 onglets sur 2 lignes). Voir
 * AdminShell.tsx, AdminFinanceSubNav.tsx, GestionShell.tsx pour les trois
 * regroupements construits avec ce composant.
 *
 * Volontairement sans style propre sur le déclencheur : il reçoit
 * `triggerClassName`/`activeClassName` de l'appelant (les mêmes classes que
 * les liens simples voisins, ex. `styles.navLien`/`styles.navLienActif`),
 * pour rester visuellement identique à eux. Seul le panneau déroulant a son
 * propre style (DropdownNavGroup.module.css), neutre et réutilisable
 * partout.
 *
 * Ouverture au clic (pas au survol, pour fonctionner aussi bien au tactile
 * qu'au clavier) — fermeture au clic extérieur, à Échap, ou en choisissant
 * un enfant.
 */
export function DropdownNavGroup({
  label,
  enfants,
  actif,
  triggerClassName,
  activeClassName,
}: {
  label: string;
  enfants: LienEnfant[];
  actif: boolean;
  triggerClassName: string;
  activeClassName: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [ouvert]);

  return (
    <div className={styles.racine} ref={racineRef}>
      <button
        type="button"
        className={`${triggerClassName} ${actif ? activeClassName : ""} ${styles.declencheur}`}
        data-nav-actif={actif ? "true" : undefined}
        aria-haspopup="true"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        {label}
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {ouvert && (
        <div className={styles.panneau} role="menu">
          {enfants.map((e) => (
            <Link key={e.href} href={e.href} className={styles.itemPanneau} role="menuitem" onClick={() => setOuvert(false)}>
              {e.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
