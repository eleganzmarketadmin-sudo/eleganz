/**
 * Marque ELEGANZ (12 oct. 2026) : un losange coupé en quatre, une couleur de
 * marque par quartier (Cobalt, Flamme, Or, Magenta Sape) — la même
 * construction géométrique qu'un carré de pochette plié en quatre pointes,
 * ou qu'un motif de tissu wax/Kuba à losanges. Aplats pleins uniquement,
 * jamais de dégradé ni d'ombre, conformément à docs/DESIGN_SYSTEM.md. Sert
 * de point focal "fun" dans l'en-tête sans sortir du système de couleurs.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <polygon points="20,20 20,2 38,20" fill="#17408a" />
      <polygon points="20,20 38,20 20,38" fill="#c83e1f" />
      <polygon points="20,20 20,38 2,20" fill="#d9a61a" />
      <polygon points="20,20 2,20 20,2" fill="#a62368" />
    </svg>
  );
}

/** Les quatre teintes de la marque, dans l'ordre utilisé par LogoMark — pour
 * la bande de séparation sous les en-têtes (voir *Shell.module.css). */
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
