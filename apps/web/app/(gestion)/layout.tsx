import { ShopProvider } from "../lib/shop-context";
import { OfflineSyncProvider } from "../lib/offline-sync";

export default function GestionGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <OfflineSyncProvider>{children}</OfflineSyncProvider>
    </ShopProvider>
  );
}
