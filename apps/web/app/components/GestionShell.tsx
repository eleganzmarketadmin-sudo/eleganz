"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import styles from "./GestionShell.module.css";

const LIENS = [
  { href: "/caisse", label: "Caisse" },
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/equipe", label: "Équipe" },
];

export function GestionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { shops, currentShop, setCurrentShopId } = useShop();

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
      <main className={styles.contenu}>{children}</main>
    </div>
  );
}
