/**
 * Marque ELEGANZ — « La Gemme » (15 nov. 2026). Remplace l'ancien losange à
 * quatre quartiers : un monogramme E taillé à facettes, choisi par le client
 * après comparaison de plusieurs pistes (voir le canevas de proposition de
 * marque). Trois éléments, aplats pleins, conformément à
 * docs/DESIGN_SYSTEM.md :
 *   - la colonne (Encre #15171C) — la colonne vertébrale qui tient
 *     l'ensemble, l'assistant et le centre de pilotage en arrière-plan ;
 *   - les trois arêtes (Cobalt #17408A) — chacune taillée en pointe plutôt
 *     que carrée, comme Gestion, Market et Livreur : des usages distincts,
 *     une seule structure ;
 *   - la pointe (Or #D9A61A) — un seul reflet, jamais plusieurs : la marque
 *     reste sobre.
 * Vérifié lisible jusqu'à 24 px (taille favicon) sur le canevas de
 * proposition. Les sources SVG sont conservées dans docs/marque/.
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
      <path d="M18,10 L32,10 L32,90 L18,90 Z" fill="#15171c" />
      <path d="M32,10 L80,10 L70,26 L32,26 Z" fill="#17408a" />
      <path d="M32,46 L62,46 L58,58 L32,58 Z" fill="#17408a" />
      <path d="M32,74 L70,74 L80,90 L32,90 Z" fill="#17408a" />
      <path d="M74,10 L80,10 L73,17 Z" fill="#d9a61a" />
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
