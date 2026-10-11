import { ShopProvider } from "../lib/shop-context";

export default function GestionGroupLayout({ children }: { children: React.ReactNode }) {
  return <ShopProvider>{children}</ShopProvider>;
}
