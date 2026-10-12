import type { Metadata, Viewport } from "next";
import { fraunces, plexMono, plexSans } from "./fonts";
import { AuthProvider } from "./lib/auth";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import { SCRIPT_INIT_THEME } from "./components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELEGANZ",
  description: "ELEGANZ Gestion & Marketplace — commerce et mode en République démocratique du Congo",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
