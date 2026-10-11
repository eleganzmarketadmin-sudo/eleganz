import type { Metadata } from "next";
import { fraunces, plexMono, plexSans } from "./fonts";
import { AuthProvider } from "./lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELEGANZ",
  description: "ELEGANZ Gestion & Marketplace — commerce et mode en République démocratique du Congo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
