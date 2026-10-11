"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useShop } from "../lib/shop-context";
import { GestionShell } from "./GestionShell";

/**
 * Enveloppe chaque écran Gestion protégé : redirige vers /connexion si
 * personne n'est authentifié. Ce n'est qu'un confort de navigation — la
 * vraie barrière est toujours côté serveur (JwtAuthGuard, ShopMembershipGuard).
 */
export function ProtectedGestionPage({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { shops, currentShop, loading: shopLoading } = useShop();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/connexion");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <GestionShell>
      {shopLoading ? (
        <p>Chargement de vos boutiques…</p>
      ) : shops.length === 0 ? (
        <p>
          Aucune boutique n&apos;est encore associée à ce compte.{" "}
          <Link href="/boutique/nouvelle">Créer ma boutique</Link> pour commencer à vendre.
        </p>
      ) : !currentShop ? (
        <p>Choisissez une boutique en haut de l&apos;écran.</p>
      ) : (
        children
      )}
    </GestionShell>
  );
}
