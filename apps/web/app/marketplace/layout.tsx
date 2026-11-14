import type { Metadata } from "next";
import { CartProvider } from "../lib/cart-context";
import { Footer } from "../components/Footer";
import { ChatWidget } from "../components/ChatWidget";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { MarqueurVisiteMarketplace } from "./MarqueurVisiteMarketplace";

// Manifest dédié (14 nov. 2026, demande : "sur toutes les versions (apps,
// téléphone, laptop) ... la marketplace utilisée comme page d'accueil") —
// remplace, pour tout ce sous-arbre, le manifest par défaut
// (public/manifest.json : nom "ELEGANZ Gestion", start_url "/caisse").
// Sans ça, un visiteur qui installe "l'app" depuis une page Marketplace
// (bouton natif du navigateur "Ajouter à l'écran d'accueil"/"Installer")
// obtenait une icône nommée "ELEGANZ Gestion" qui rouvrait directement
// l'écran caisse — un écran de vendeur, sans rapport pour un acheteur, et
// qui exige en plus une connexion Gestion qu'un acheteur n'a jamais.
export const metadata: Metadata = {
  manifest: "/manifest-marketplace.json",
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <MarqueurVisiteMarketplace />
        <MarketplaceHeader />
        <div className="entree-page" style={{ flex: 1 }}>
          {children}
        </div>
        <Footer variante="marketplace" />
        <ChatWidget />
      </div>
    </CartProvider>
  );
}
