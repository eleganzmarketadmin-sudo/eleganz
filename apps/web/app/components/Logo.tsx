/**
 * Marque ELEGANZ — « La Gemme » (15 nov. 2026). Remplace l'ancien losange à
 * quatre quartiers : un monogramme E taillé à facettes, choisi par le client
 * après comparaison de plusieurs pistes (voir le canevas de proposition de
 * marque). Trois éléments, aplats pleins, conformément à
 * docs/DESIGN_SYSTEM.md :
 *   - la colonne (Encre) — la colonne vertébrale qui tient l'ensemble,
 *     l'assistant et le centre de pilotage en arrière-plan ;
 *   - les trois arêtes (Cobalt) — chacune taillée en pointe plutôt que
 *     carrée, comme Gestion, Market et Livreur : des usages distincts, une
 *     seule structure ;
 *   - la pointe (Or) — un seul reflet, jamais plusieurs : la marque reste
 *     sobre.
 *
 * Signalement du 15 nov. 2026 : rendue d'abord en couleurs fixes
 * (#15171C/#17408A/#D9A61A), la colonne se fondait dans le fond
 * --color-encre-fixe des en-têtes Gestion/Admin/Comptable/Institution/
 * Livreur/Market/pied de page (également #15171C), et les arêtes y
 * tombaient à ~1.8:1 de contraste — exactement le problème déjà documenté
 * pour le texte dans globals.css (--color-*-sur-fonce). Les trois teintes
 * sont donc des variables CSS, chacune avec un filet de secours qui suit
 * le thème clair/sombre normal (--color-ink / --color-cobalt-texte) ; les
 * en-têtes et le pied de page à fond fixe-sombre les redéfinissent en
 * blanc / --color-cobalt-sur-fonce dans leur propre règle .entete / .pied
 * (l'or reste inchangé partout : déjà ~7.5:1 sur --color-encre-fixe).
 * Vérifié lisible jusqu'à 24 px (taille favicon) sur le canevas de
 * proposition — ce réglage de contraste n'a pas été revérifié à cette
 * taille, mais la retouche ne change que la couleur, pas les formes.
 * Les sources SVG sont conservées dans docs/marque/.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path d="M18,10 L32,10 L32,90 L18,90 Z" style={{ fill: "var(--logo-colonne, var(--color-ink))" }} />
      <path d="M32,10 L80,10 L70,26 L32,26 Z" style={{ fill: "var(--logo-aretes, var(--color-cobalt-texte))" }} />
      <path d="M32,46 L62,46 L58,58 L32,58 Z" style={{ fill: "var(--logo-aretes, var(--color-cobalt-texte))" }} />
      <path d="M32,74 L70,74 L80,90 L32,90 Z" style={{ fill: "var(--logo-aretes, var(--color-cobalt-texte))" }} />
      <path d="M74,10 L80,10 L73,17 Z" style={{ fill: "var(--logo-pointe, var(--color-or))" }} />
    </svg>
  );
}

/** Les quatre couleurs de marque (palette de docs/DESIGN_SYSTEM.md), pour la
 * bande de séparation sous les en-têtes (voir *Shell.module.css) — un motif
 * à la manière du tissu wax, indépendant du monogramme LogoMark ci-dessus. */
export const COULEURS_MARQUE = ["#17408a", "#c83e1f", "#d9a61a", "#a62368"];

export function BandeMarque({ className }: { className?: string }) {
  return (
    <div className={className} style={{ display: "flex", height: "4px" }} aria-hidden="true">
      {COULEURS_MARQUE.map((couleur) => (
        <span key={couleur} style={{ background: couleur, flex: 1 }} />
      ))}
    </div>
  );
}
