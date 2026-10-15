"use client";

import { AdminShell } from "../AdminShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieAdminPage() {
  const { t } = useLocale();
  return (
    <AdminShell>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </AdminShell>
  );
}
