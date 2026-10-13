"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import { useOfflineSync } from "../lib/offline-sync";
import { ThemeToggle } from "./ThemeToggle";
import { LogoMark, BandeMarque } from "./Logo";
import { Footer } from "./Footer";
import styles from "./GestionShell.module.css";

const LIENS = [
  { href: "/caisse", label: "Caisse" },
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/commandes", label: "Commandes" },
  { href: "/factures", label: "Mes factures" },
  { href: "/releves", label: "Relevés d'activité" },
  { href: "/litiges", label: "Litiges" },
  { href: "/finance", label: "Finance & Comptabilité" },
  { href: "/livreurs", label: "Livreurs" },
  { href: "/equipe", label: "Équipe" },
  { href: "/parametres", label: "Paramètres" },
];

// Un comptable externe (StaffRole.EXTERNAL_ACCOUNTANT) n'a, côté API, accès
// qu'en lecture seule à Finance & Comptabilité (docs/ARCHITECTURE_FINANCE.md
// §8sexies) — masquer les autres onglets évite de lui montrer un lien qui
// échouerait systématiquement avec une erreur 403.
const LIEN_FINANCE_SEUL = LIENS.filter((l) => l.href === "/finance");

export function GestionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { shops, currentShop, setCurrentShopId } = useShop();
  const { nombreEnAttente, synchroniser } = useOfflineSync();
  const liens = currentShop?.myRole === "EXTERNAL_ACCOUNTANT" ? LIEN_FINANCE_SEUL : LIENS;

  return (
    <div className={styles.cadre}>
      <header className={styles.entete}>
        <div className={styles.marqueBloc}>
          <LogoMark size={30} />
          <div>
            <div className={styles.marque}>
              ELEGANZ <span>Gestion</span>
            </div>
            {currentShop && <div className={styles.boutiqueNom}>{currentShop.name}</div>}
          </div>
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
      <BandeMarque />
      <nav className={styles.nav}>
        {liens.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            className={`${styles.navLien} ${
              pathname === lien.href || pathname?.startsWith(`${lien.href}/`) ? styles.navLienActif : ""
            }`}
          >
            {lien.label}
          </Link>
        ))}
      </nav>
      <main className={styles.contenu} key={pathname}>
        <div className="entree-page">{children}</div>
      </main>
      <Footer variante="gestion" />
    </div>
  );
}
