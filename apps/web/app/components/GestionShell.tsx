"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import { useOfflineSync } from "../lib/offline-sync";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./GestionShell.module.css";

const LIENS = [
  { href: "/caisse", label: "Caisse" },
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/commandes", label: "Commandes" },
  { href: "/litiges", label: "Litiges" },
  { href: "/equipe", label: "Équipe" },
];

export function GestionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { shops, currentShop, setCurrentShopId } = useShop();
  const { nombreEnAttente, synchroniser } = useOfflineSync();

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <div>
          <div className={styles.marque}>
            ELEGANZ <span>GESTION</span>
          </div>
          {currentShop && <div className={styles.boutiqueNom}>{currentShop.name}</div>}
        </div>
        <div className={styles.droite}>
          {nombreEnAttente > 0 && (
            <button
              onClick={synchroniser}
              title="Cliquer pour tenter de synchroniser maintenant"
              style={{
                background: "var(--color-or)",
                color: "var(--color-encre-fixe)",
                border: "none",
                padding: "8px 12px",
                minHeight: "40px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {nombreEnAttente} vente(s) en attente de synchronisation
            </button>
          )}
          {shops.length > 1 && (
            <select
              aria-label="Choisir la boutique"
              value={currentShop?.id ?? ""}
              onChange={(e) => setCurrentShopId(e.target.value)}
              style={{ padding: "8px", minHeight: "40px" }}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <ThemeToggle clair />
          <button
            className={styles.deconnexion}
            onClick={() => {
              logout();
              router.push("/connexion");
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>
      <nav className={styles.nav}>
        {LIENS.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${pathname === lien.href ? styles.navLienActif : ""}`}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
    </div>
  );
}
