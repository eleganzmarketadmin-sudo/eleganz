import type { Metadata, Viewport } from "next";
import { fraunces, plexMono, plexSans } from "./fonts";
import { AuthProvider } from "./lib/auth";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
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
      <body>
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
