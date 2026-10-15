"use client";

import { ComptableShell } from "../ComptableShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";
import { useLocale } from "../../lib/i18n/LocaleContext";

export default function MessagerieComptablePage() {
  const { t } = useLocale();
  return (
    <ComptableShell>
      <h1>{t("nav_messagerie")}</h1>
      <MessagerieEcran />
    </ComptableShell>
  );
}
