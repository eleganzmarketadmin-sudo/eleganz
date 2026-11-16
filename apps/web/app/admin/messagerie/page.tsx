"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "../AdminShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

/**
 * Enveloppe `useSearchParams` dans un Suspense (convention de l'App Router,
 * voir marketplace/page.tsx) — nécessaire pour lire ?destinataireId=&nom=
 * (16 nov. 2026 : le bouton "Message interne" d'admin/institutions amène
 * ici avec un destinataire déjà choisi, voir MessagerieEcran.destinataireInitial,
 * au lieu de forcer l'admin à le rechercher à nouveau par nom).
 */
export default function MessagerieAdminPage() {
  return (
    <Suspense fallback={null}>
      <MessagerieAdminContenu />
    </Suspense>
  );
}

function MessagerieAdminContenu() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const destinataireId = searchParams.get("destinataireId");
  const nom = searchParams.get("nom");

  return (
    <AdminShell>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran destinataireInitial={destinataireId && nom ? { id: destinataireId, nom } : null} />
    </AdminShell>
  );
}
