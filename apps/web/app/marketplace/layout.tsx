import { CartProvider } from "../lib/cart-context";
import { MarketplaceHeader } from "./MarketplaceHeader";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <MarketplaceHeader />
      <div className="entree-page">{children}</div>
    </CartProvider>
  );
}
