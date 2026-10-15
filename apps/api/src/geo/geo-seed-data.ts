import { Continent } from "@eleganz/database";

/**
 * Données de référence pays/villes (demande du 15 oct. 2026 : zones de
 * livraison des vendeurs Marketplace). Amorcée volontairement avec la RDC
 * et ses 9 pays limitrophes — l'ouverture aux autres pays est un objectif à
 * terme (réponse du propriétaire : "Afrique, puis Asie, Amérique, Europe
 * etc."), mais n'ajoute ici que des lignes de seed, jamais de nouvelle
 * migration (voir schema.prisma, modèles Country/City).
 *
 * `isoCode` : ISO 3166-1 alpha-2. `name` : nom canonique français, utilisé
 * en repli tant qu'aucune traduction n'existe dans translations.ts (clé
 * pays_<isoCode>) pour la langue active.
 */
export const GEO_SEED: { isoCode: string; name: string; continent: Continent; villes: string[] }[] = [
  {
    isoCode: "CD",
    name: "République démocratique du Congo",
    continent: Continent.AFRIQUE,
    villes: [
      "Kinshasa",
      "Lubumbashi",
      "Mbuji-Mayi",
      "Kananga",
      "Kisangani",
      "Bukavu",
      "Goma",
      "Matadi",
      "Kolwezi",
      "Likasi",
      "Tshikapa",
      "Uvira",
      "Butembo",
      "Kikwit",
      "Mbandaka",
    ],
  },
  {
    isoCode: "CG",
    name: "République du Congo",
    continent: Continent.AFRIQUE,
    villes: ["Brazzaville", "Pointe-Noire", "Dolisie"],
  },
  {
    isoCode: "CF",
    name: "République centrafricaine",
    continent: Continent.AFRIQUE,
    villes: ["Bangui", "Berbérati"],
  },
  {
    isoCode: "SS",
    name: "Soudan du Sud",
    continent: Continent.AFRIQUE,
    villes: ["Djouba", "Wau"],
  },
  {
    isoCode: "UG",
    name: "Ouganda",
    continent: Continent.AFRIQUE,
    villes: ["Kampala", "Entebbe", "Gulu"],
  },
  {
    isoCode: "RW",
    name: "Rwanda",
    continent: Continent.AFRIQUE,
    villes: ["Kigali", "Huye", "Gisenyi"],
  },
  {
    isoCode: "BI",
    name: "Burundi",
    continent: Continent.AFRIQUE,
    villes: ["Bujumbura", "Gitega"],
  },
  {
    isoCode: "TZ",
    name: "Tanzanie",
    continent: Continent.AFRIQUE,
    villes: ["Dar es Salaam", "Dodoma", "Mwanza"],
  },
  {
    isoCode: "ZM",
    name: "Zambie",
    continent: Continent.AFRIQUE,
    villes: ["Lusaka", "Ndola", "Kitwe"],
  },
  {
    isoCode: "AO",
    name: "Angola",
    continent: Continent.AFRIQUE,
    villes: ["Luanda", "Cabinda", "Lubango"],
  },
];
