"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Boutique {
  id: string;
  name: string;
  mode: string;
  status: string;
  isPubliclyListed: boolean;
  createdAt: string;
  owner: { fullName: string; email: string | null; phone: string | null };
  marketplaceBouquet: { id: string; name: string } | null;
  gestionBouquet: { id: string; name: string } | null;
  _count: { products: number; orders: number };
}

const LIBELLES_STATUT: Record<string, string> = {
  PENDING_VALIDATION: "En attente de validation",
  FREE_PERIOD: "Période gratuite",
  ACTIVE: "Active",
  PAYMENT_DUE: "Paiement dû",
  SUSPENDED: "Suspendue",
  CLOSED: "Fermée",
};

function BoutiquesContent() {
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Boutique[]>("/admin/shops")
      .then(setBoutiques)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function basculer(shopId: string, action: "suspend" | "reactivate") {
    setEnCours(shopId);
    setErreur(null);
    try {
      await api.post(`/admin/shops/${shopId}/${action}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des boutiques…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Boutiques</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {boutiques.length === 0 ? (
        <p className={styles.messageVide}>Aucune boutique inscrite pour l&apos;instant.</p>
      ) : (
        boutiques.map((b) => {
          const suspendue = b.status === "SUSPENDED";
          return (
            <div className={styles.boutique} key={b.id}>
              <div className={styles.entete}>
                <div>
                  <span className={styles.nom}>{b.name}</span>
                  <span
                    className={`${styles.statut} ${suspendue ? styles.statutSuspendu : ""}`}
                  >
                    {LIBELLES_STATUT[b.status] ?? b.status}
                  </span>
                </div>
                <span className={styles.date}>Inscrite le {formatDate(b.createdAt)}</span>
              </div>
              <div className={styles.corps}>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Propriétaire</span>
                  <span>{b.owner.fullName} — {b.owner.email ?? b.owner.phone}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Mode</span>
                  <span>{b.mode}{b.isPubliclyListed ? " · publiée sur la Marketplace" : ""}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Bouquet Gestion</span>
                  <span>{b.gestionBouquet?.name ?? "Aucun"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Bouquet Marketplace</span>
                  <span>{b.marketplaceBouquet?.name ?? "Aucun"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Catalogue</span>
                  <span>{b._count.products} articles · {b._count.orders} commandes reçues</span>
                </div>
              </div>
              <div className={styles.actions}>
                {suspendue ? (
                  <button
                    className={styles.boutonReactiver}
                    disabled={enCours === b.id}
                    onClick={() => basculer(b.id, "reactivate")}
                  >
                    Réactiver
                  </button>
                ) : (
                  <button
                    className={styles.boutonSuspendre}
                    disabled={enCours === b.id}
                    onClick={() => basculer(b.id, "suspend")}
                  >
                    Suspendre
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function AdminBoutiquesPage() {
  return (
    <AdminShell>
      <BoutiquesContent />
    </AdminShell>
  );
}
