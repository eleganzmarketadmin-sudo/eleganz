"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Litige {
  id: string;
  reason: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  shopOrder: { id: string; lines: { id: string }[] };
}

const LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  UNDER_REVIEW: "En cours d'examen",
  RESOLVED: "Résolu",
};

function LitigesContent() {
  const { currentShop } = useShop();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<Litige[]>(`/shops/${currentShop.id}/disputes`)
      .then(setLitiges)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop]);

  return (
    <div>
      <h1 className={styles.titre}>Litiges</h1>
      {erreur && <p>{erreur}</p>}
      {chargement ? (
        <p>Chargement…</p>
      ) : litiges.length === 0 ? (
        <p className={styles.messageVide}>Aucun litige ouvert contre cette boutique.</p>
      ) : (
        litiges.map((l) => (
          <div className={styles.litige} key={l.id}>
            <div className={styles.entete}>
              <span>Commande #{l.shopOrder.id.slice(0, 8)} — {formatDate(l.createdAt)}</span>
              <StatusTag
                label={LABELS[l.status] ?? l.status}
                humeur={l.status === "RESOLVED" ? "paye" : "alerte"}
              />
            </div>
            <p className={styles.motif}>{l.reason}</p>
            {l.resolution && <div className={styles.resolution}>Décision : {l.resolution}</div>}
          </div>
        ))
      )}
      <p style={{ color: "#555", fontSize: "0.875rem", marginTop: "16px" }}>
        L&apos;examen et la résolution d&apos;un litige restent du ressort de l&apos;administration
        ELEGANZ — cette page est une vue de suivi, pas un outil de décision.
      </p>
    </div>
  );
}

export default function LitigesPage() {
  return (
    <ProtectedGestionPage>
      <LitigesContent />
    </ProtectedGestionPage>
  );
}
