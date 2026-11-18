// Secteurs d'activité des boutiques (18 nov. 2026, chantier "gestion de
// risque autonome" Phase 2) — même liste fermée que l'enum Prisma
// SecteurActiviteBoutique (packages/database/prisma/schema.prisma),
// partagée ici entre la page de création de boutique, les paramètres de
// boutique et la liste admin des boutiques pour ne jamais la dupliquer à
// trois endroits différents. Chaque valeur a sa clé de traduction
// secteur_<VALEUR> dans translations.ts.
export const SECTEURS_ACTIVITE = [
  "MODE_HABILLEMENT",
  "ALIMENTATION_AGROALIMENTAIRE",
  "ELECTRONIQUE_TELEPHONIE",
  "BEAUTE_COSMETIQUE",
  "MAISON_DECORATION",
  "SANTE_PHARMACIE",
  "AUTOMOBILE_PIECES",
  "QUINCAILLERIE_BRICOLAGE",
  "AGRICULTURE_ELEVAGE",
  "ARTISANAT_LOISIRS",
  "SERVICES",
  "AUTRE",
] as const;

export type SecteurActivite = (typeof SECTEURS_ACTIVITE)[number];
