"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Livreur {
  id: string;
  zone: string | null;
  verified: boolean;
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
    isSuspended: boolean;
  };
  _count: { deliveries: number };
}

/**
 * Centre de gestion des partenaires livreurs (prompt §10 et §37). Un livreur
 * créé par auto-inscription n'est jamais vérifié par défaut (voir
 * DeliveryService.registerDriver) — assignDriver() refuse toute affectation
 * de mission à un livreur non vérifié, donc cette bascule est le seul moyen,
 * sans toucher au code, de rendre un livreur réellement opérationnel.
 */
function LivreursContent() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Livreur[]>("/delivery/drivers")
      .then(setLivreurs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function basculerVerification(driverId: string, verified: boolean) {
    setEnCours(driverId);
    setErreur(null);
    try {
      await api.post(`/delivery/drivers/${driverId}/verify`, { verified });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des livreurs…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Livreurs</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {livreurs.length === 0 ? (
        <p className={styles.messageVide}>Aucun livreur inscrit pour l&apos;instant.</p>
      ) : (
        livreurs.map((l) => (
          <div className={styles.boutique} key={l.id}>
            <div className={styles.entete}>
              <div>
                <span className={styles.nom}>{l.user.fullName}</span>
                <span className={`${styles.statut} ${!l.verified ? styles.statutSuspendu : ""}`}>
                  {l.verified ? "Vérifié" : "Non vérifié"}
                </span>
              </div>
              <span className={styles.date}>Inscrit le {formatDate(l.user.createdAt)}</span>
            </div>
            <div className={styles.corps}>
              <div className={styles.champInfo}>
                <span className={styles.champLabel}>Contact</span>
                <span>{l.user.email ?? l.user.phone}</span>
              </div>
              <div className={styles.champInfo}>
                <span className={styles.champLabel}>Zone</span>
                <span>{l.zone ?? "Non précisée"}</span>
              </div>
              <div className={styles.champInfo}>
                <span className={styles.champLabel}>Missions</span>
                <span>{l._count.deliveries} livraison(s) au total</span>
              </div>
            </div>
            <div className={styles.actions}>
              {l.verified ? (
                <button
                  className={styles.boutonSuspendre}
                  disabled={enCours === l.id}
                  onClick={() => basculerVerification(l.id, false)}
                >
                  Retirer la vérification
                </button>
              ) : (
                <button
                  className={styles.boutonReactiver}
                  disabled={enCours === l.id}
                  onClick={() => basculerVerification(l.id, true)}
                >
                  Vérifier ce livreur
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminLivreursPage() {
  return (
    <AdminShell>
      <LivreursContent />
    </AdminShell>
  );
}
