import type { Metadata, Viewport } from "next";
import { fraunces, plexMono, plexSans } from "./fonts";
import { AuthProvider } from "./lib/auth";
import { ExchangeRateProvider } from "./lib/exchange-rate";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import { SCRIPT_INIT_THEME } from "./components/ThemeToggle";
import { LocaleProvider } from "./lib/i18n/LocaleContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELEGANZ",
  description: "ELEGANZ Gestion & Marketplace — commerce et mode en République démocratique du Congo",
  manifest: "/manifest.json",
};

// 2 nov. 2026 (signalement : "le format mobile et application continuent à
// déborder l'écran au moment de balayage ou défilement") — cause probable :
// dès qu'on exporte un objet `viewport` personnalisé dans Next.js (ici pour
// `themeColor`), Next n'ajoute PLUS automatiquement `width=device-width,
// initial-scale=1` à la balise <meta name="viewport"> — il faut les
// redéclarer explicitement, sinon le navigateur mobile rend la page à une
// largeur de bureau par défaut (~980px) puis la réduit à l'échelle pour
// tenir dans l'écran, ce qui autorise justement ce débordement/zoom arrière
// au balayage. `themeColor` seul ne suffisait donc pas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17408a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <head>
        {/* Applique le thème enregistré avant le premier rendu — évite le
            flash d'un mauvais thème (voir ThemeToggle.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_INIT_THEME }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <LocaleProvider>
          <AuthProvider>
            <ExchangeRateProvider>{children}</ExchangeRateProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
