"use client";

import { LivreurShell } from "../LivreurShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieLivreurPage() {
  const { t } = useLocale();
  return (
    <LivreurShell>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </LivreurShell>
  );
}
