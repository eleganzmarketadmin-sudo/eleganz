"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieMarketplacePage() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/marketplace/compte?retour=/marketplace/messagerie");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </>
  );
}
