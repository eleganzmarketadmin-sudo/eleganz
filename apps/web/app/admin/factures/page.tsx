"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Facture {
  id: string;
  shopId: string;
  shop: { id: string; name: string };
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  createdAt: string;
}

const LIBELLES_STATUT: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  OVERDUE: "En retard",
  WAIVED: "Dispensée",
};

function FacturesContent() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Facture[]>("/admin/billing/invoices")
      .then(setFactures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function marquerPayee(invoiceId: string) {
    setEnCours(invoiceId);
    setErreur(null);
    try {
      await api.post(`/admin/billing/invoices/${invoiceId}/mark-paid`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function lancerVerification(type: "run-trial-check" | "run-suspension-check") {
    setVerificationEnCours(type);
    setErreur(null);
    setMessage(null);
    try {
      const resultats = await api.post<{ shopId: string; action: string }[]>(`/admin/billing/${type}`);
      setMessage(
        resultats.length === 0
          ? "Aucune boutique concernée pour l'instant."
          : `${resultats.length} boutique(s) mise(s) à jour.`,
      );
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Vérification impossible.");
    } finally {
      setVerificationEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des factures…</p>;

  const enAttente = factures.filter((f) => f.status === "PENDING");
  const autres = factures.filter((f) => f.status !== "PENDING");

  return (
    <div>
      <h1 className={styles.titre}>Factures</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>Fin de période gratuite</p>
          <p className={styles.verifDescription}>
            Fait passer en paiement dû les boutiques dont la période gratuite est écoulée, et génère leur facture.
          </p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-trial-check")}
        >
          Vérifier maintenant
        </button>
      </div>
      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>Retards de paiement</p>
          <p className={styles.verifDescription}>
            Suspend les boutiques dont une facture est impayée depuis plus de 7 jours après son échéance.
          </p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-suspension-check")}
        >
          Vérifier maintenant
        </button>
      </div>

      <h2 className={styles.sectionTitre}>En attente de paiement</h2>
      {enAttente.length === 0 ? (
        <p className={styles.messageVide}>Aucune facture en attente.</p>
      ) : (
        enAttente.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{f.shop.name}</span>
              <span>{f.kind}</span>
              <span>{formatMoney(Number(f.amount))}</span>
              <span>Échéance : {formatDate(f.dueAt)}</span>
            </div>
            <button
              className={styles.boutonPayer}
              disabled={enCours === f.id}
              onClick={() => marquerPayee(f.id)}
            >
              Marquer payée
            </button>
          </div>
        ))
      )}

      <h2 className={styles.sectionTitre}>Historique</h2>
      {autres.length === 0 ? (
        <p className={styles.messageVide}>Aucune autre facture.</p>
      ) : (
        autres.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{f.shop.name}</span>
              <span>{f.kind}</span>
              <span>{formatMoney(Number(f.amount))}</span>
              <span className={styles.statutHistorique}>{LIBELLES_STATUT[f.status] ?? f.status}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminFacturesPage() {
  return (
    <AdminShell>
      <FacturesContent />
    </AdminShell>
  );
}
