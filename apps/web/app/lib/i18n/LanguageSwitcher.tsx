"use client";

import { useLocale } from "./LocaleContext";
import { LOCALES, Locale } from "./translations";
import styles from "./LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const { locale, setLocale, t, reviewRecommended } = useLocale();

  return (
    <div className={styles.cadre}>
      <select
        className={styles.select}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("langue_label")}
        title={t("langue_label")}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      {reviewRecommended && <span className={styles.pastilleRevue} title={t("langue_reviewNotice")} />}
    </div>
  );
}
