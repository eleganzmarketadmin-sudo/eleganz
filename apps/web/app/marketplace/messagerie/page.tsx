"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { getToken } from "../../lib/api";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieMarketplacePage() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    // Voir le commentaire détaillé dans AdminShell.tsx (13 nov. 2026) : on
    // revérifie le jeton stocké avant de rediriger, pour ne pas renvoyer à
    // tort vers la connexion un utilisateur fraîchement authentifié.
    if (!loading && !user && !getToken()) router.replace("/marketplace/compte?retour=/marketplace/messagerie");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </>
  );
}
