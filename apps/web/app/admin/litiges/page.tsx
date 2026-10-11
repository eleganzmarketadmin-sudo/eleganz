"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Litige {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  shopOrder: { id: string; shop: { name: string } };
}

function LitigesContent() {
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Litige[]>("/admin/disputes")
      .then(setLitiges)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function resoudre(disputeId: string) {
    const resolution = resolutions[disputeId];
    if (!resolution) return;
    setEnCours(disputeId);
    try {
      await api.patch(`/admin/disputes/${disputeId}/resolve`, { resolution });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Résolution impossible.");
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Litiges ouverts</h1>
      {erreur && <p>{erreur}</p>}

      {litiges.length === 0 ? (
        <p className={styles.messageVide}>Aucun litige ouvert pour l&apos;instant.</p>
      ) : (
        litiges.map((l) => (
          <div className={styles.litige} key={l.id}>
            <div className={styles.entete}>
              <span>{l.shopOrder.shop.name}</span>
              <span>{formatDate(l.createdAt)}</span>
            </div>
            <p className={styles.motif}>{l.reason}</p>
            <div className={styles.resolution}>
              <input
                placeholder="Décision (ex. remboursement intégral, article renvoyé)"
                value={resolutions[l.id] ?? ""}
                onChange={(e) => setResolutions((prev) => ({ ...prev, [l.id]: e.target.value }))}
              />
              <button
                className={styles.bouton}
                disabled={enCours === l.id || !resolutions[l.id]}
                onClick={() => resoudre(l.id)}
              >
                Résoudre
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminLitigesPage() {
  return (
    <AdminShell>
      <LitigesContent />
    </AdminShell>
  );
}
