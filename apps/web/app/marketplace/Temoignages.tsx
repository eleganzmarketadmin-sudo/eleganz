"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
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
      <h2 className={styles.titre}>Ce que disent les acheteurs</h2>
      {temoignages.length === 0 ? (
        <p className={styles.vide}>
          Les premiers avis apparaîtront ici dès que des acheteurs partageront leur expérience.
        </p>
      ) : (
        <div className={styles.grille}>
          {temoignages.map((t) => (
            <div className={styles.carte} key={t.id}>
              <Etoiles note={t.rating} />
              {t.comment && <p className={styles.commentaire}>&laquo; {t.comment} &raquo;</p>}
              <div className={styles.auteur}>
                {t.auteur} — {t.boutique}
                {t.verifiedPurchase && <span className={styles.badge}>Achat vérifié</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
