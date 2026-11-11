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

  // Cloisonnement par module (demande du 10 nov. 2026, point 5) — même
  // principe déjà en place côté AdminShell/LivreurShell : le vrai jeton
  // Gestion est désormais refusé dès /auth/login pour un rôle incompatible
  // (voir AuthService.login), mais Gestion partage sa clé de jeton avec
  // Marketplace (espaceAuth() === "defaut", voir api.ts — "Mon assistant"/
  // Secourable a sa propre clé depuis le 11 nov. 2026), donc un compte
  // connecté via /marketplace/compte pourrait sinon naviguer directement
  // vers /(gestion)/... avec un jeton valide d'un autre rôle. Ce contrôle
  // couvre ce cas, en plus du refus à la connexion.
  if (user.role !== "SHOP_OWNER" && user.role !== "SHOP_STAFF") {
    return (
      <GestionShell>
        <p>Ce compte n&apos;a pas accès à ELEGANZ Gestion.</p>
      </GestionShell>
    );
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
