"use client";

import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./BoutonBientotDisponible.module.css";

/**
 * Point d'entrée visible mais désactivé pour une fonctionnalité IA déjà
 * prévue dans le cahier des charges (recherche par photo, studio
 * publicitaire) mais pas encore branchée à un fournisseur — demande du
 * 12 oct. 2026 : "prévoir mais rendre inactif". Jamais cliquable tant que la
 * fonctionnalité réelle n'est pas développée, quel que soit l'interrupteur
 * admin (voir docs/PROJECT_STATUS.md).
 */
export function BoutonBientotDisponible({ icone, label }: { icone: string; label: string }) {
  const { t } = useLocale();
  return (
    <button type="button" className={styles.bouton} disabled title={t("bientotDisponible_info")}>
      <span aria-hidden="true">{icone}</span> {label}
      <span className={styles.badge}>{t("bientotDisponible_badge")}</span>
    </button>
  );
}
