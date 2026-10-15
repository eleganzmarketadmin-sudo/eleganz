"use client";

import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieGestionPage() {
  const { t } = useLocale();
  return (
    <ProtectedGestionPage>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </ProtectedGestionPage>
  );
}
