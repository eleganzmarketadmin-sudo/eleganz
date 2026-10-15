import { CartProvider } from "../lib/cart-context";
import { Footer } from "../components/Footer";
import { ChatWidget } from "../components/ChatWidget";
import { MarketplaceHeader } from "./MarketplaceHeader";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
