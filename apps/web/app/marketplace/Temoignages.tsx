"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./Temoignages.module.css";

interface Temoignage {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  auteur: string;
  boutique: string;
}

function Etoiles({ note }: { note: number }) {
  return (
    <span className={styles.etoiles} aria-label={`${note} sur 5`}>
      {"★".repeat(note)}
      <span className={styles.etoilesVides}>{"★".repeat(5 - note)}</span>
    </span>
  );
}

/**
 * Section "Témoignages" (prompt du 12 oct. 2026) — renforce la crédibilité
 * de la plateforme. La plateforme étant jeune, il n'y a pas toujours d'avis
 * à montrer : plutôt que de cacher la section ou d'inventer des
 * témoignages, on affiche un état d'accueil honnête qui invite les premiers
 * acheteurs à en laisser un.
 */
export function Temoignages() {
  const { t } = useLocale();
  const [temoignages, setTemoignages] = useState<Temoignage[] | null>(null);

  useEffect(() => {
    api
      .get<Temoignage[]>("/marketplace/temoignages", false)
      .then(setTemoignages)
      .catch(() => setTemoignages([]));
  }, []);

  if (temoignages === null) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.titre}>{t("market_temoinTitre")}</h2>
      {temoignages.length === 0 ? (
        <p className={styles.vide}>{t("market_temoinVide")}</p>
      ) : (
        <div className={styles.grille}>
          {temoignages.map((temoignage) => (
            <div className={styles.carte} key={temoignage.id}>
              <Etoiles note={temoignage.rating} />
              {temoignage.comment && (
                <p className={styles.commentaire}>&laquo; {temoignage.comment} &raquo;</p>
              )}
              <div className={styles.auteur}>
                {temoignage.auteur} — {temoignage.boutique}
                {temoignage.verifiedPurchase && (
                  <span className={styles.badge}>{t("market_achatVerifie")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
