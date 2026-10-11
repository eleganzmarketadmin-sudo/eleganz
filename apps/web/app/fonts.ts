import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// Titres Marketplace : serif à empattements taillés, du caractère.
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// Interface et texte courant, les deux produits.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// Argent, quantités, tout chiffre qui doit s'aligner.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
