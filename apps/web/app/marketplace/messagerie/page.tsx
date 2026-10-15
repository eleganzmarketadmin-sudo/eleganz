"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { MessagerieEcran } from "../../components/MessagerieEcran";

export default function MessagerieMarketplacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/marketplace/compte?retour=/marketplace/messagerie");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <>
      <h1>Messagerie</h1>
      <MessagerieEcran />
    </>
  );
}
