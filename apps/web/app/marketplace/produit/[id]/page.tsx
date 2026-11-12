import type { Metadata } from "next";
import ProduitClient from "./ProduitClient";

/**
 * Composant Serveur (11 nov. 2026, amélioration "expérience grand public",
 * point 1 : métadonnées + partage par produit) — le premier de ce genre
 * dans cette application, tout le reste étant en "use client". Next.js
 * n'autorise `generateMetadata` que depuis un module sans "use client" ;
 * toute la logique d'affichage/interaction reste dans ProduitClient.tsx
 * (inchangée), ce fichier ne fait que récupérer l'identifiant produit et
 * générer le titre/la description/l'image partagés — avant, un lien vers
 * une fiche produit partagé sur WhatsApp ou Facebook n'affichait qu'un
 * aperçu générique "ELEGANZ", jamais la photo ni le nom de l'article.
 *
 * Next.js 15 : `params` est une Promise sur les Composants Serveur (App
 * Router), d'où les deux `await` ci-dessous.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ProduitPourMetadonnees {
  name: string;
  description?: string | null;
  images: string[];
  shop: { name: string };
}

async function recupererProduit(id: string): Promise<ProduitPourMetadonnees | null> {
  try {
    // `fetch` natif, pas le client `api` (pensé pour le navigateur,
    // localStorage, etc.) : ce code tourne côté serveur, sans jeton — la
    // fiche produit est publique, exactement comme l'appel que fait déjà
    // ProduitClient depuis le navigateur.
    const reponse = await fetch(`${API_BASE}/marketplace/products/${id}`, {
      // Les fiches produit changent (stock, prix) mais la génération de
      // métadonnées n'a pas besoin d'être à la seconde près — évite de
      // doubler la charge sur l'API à chaque partage de lien.
      next: { revalidate: 300 },
    });
    if (!reponse.ok) return null;
    return (await reponse.json()) as ProduitPourMetadonnees;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const produit = await recupererProduit(id);

  if (!produit) {
    return {
      title: "Produit — ELEGANZ Marketplace",
      description: "Découvrez ce produit sur ELEGANZ Marketplace.",
    };
  }

  const titre = `${produit.name} — ELEGANZ Marketplace`;
  const description =
    produit.description?.slice(0, 160) ||
    `${produit.name}, en vente par ${produit.shop.name} sur ELEGANZ Marketplace.`;
  const image = produit.images[0];

  return {
    title: titre,
    description,
    openGraph: {
      title: titre,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: titre,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProduitClient id={id} />;
}
