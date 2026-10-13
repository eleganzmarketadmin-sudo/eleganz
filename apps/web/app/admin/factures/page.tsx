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

interface FactureLivreur {
  id: string;
  driverId: string;
  driver: { id: string; user: { fullName: string } };
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  createdAt: string;
}

interface FactureComptable {
  id: string;
  subscriptionId: string;
  subscription: { id: string; user: { fullName: string } };
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
  const [facturesLivreurs, setFacturesLivreurs] = useState<FactureLivreur[]>([]);
  const [facturesComptable, setFacturesComptable] = useState<FactureComptable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState<string | null>(null);

  function recharger() {
    Promise.all([
      api.get<Facture[]>("/admin/billing/invoices"),
      api.get<FactureLivreur[]>("/admin/driver-billing/invoices"),
      api.get<FactureComptable[]>("/admin/comptable/invoices"),
    ])
      .then(([listeFactures, listeFacturesLivreurs, listeFacturesComptable]) => {
        setFactures(listeFactures);
        setFacturesLivreurs(listeFacturesLivreurs);
        setFacturesComptable(listeFacturesComptable);
      })
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

  async function marquerPayeeLivreur(invoiceId: string) {
    setEnCours(invoiceId);
    setErreur(null);
    try {
      await api.post(`/admin/driver-billing/invoices/${invoiceId}/mark-paid`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function marquerPayeeComptable(invoiceId: string) {
    setEnCours(invoiceId);
    setErreur(null);
    try {
      await api.post(`/admin/comptable/invoices/${invoiceId}/mark-paid`);
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

      <h2 className={styles.sectionTitre}>Factures livreurs — en attente de paiement</h2>
      {facturesLivreurs.filter((f) => f.status === "PENDING").length === 0 ? (
        <p className={styles.messageVide}>Aucune facture livreur en attente.</p>
      ) : (
        facturesLivreurs
          .filter((f) => f.status === "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.driver.user.fullName}</span>
                <span>{f.kind === "opening_fee" ? "Frais d'ouverture" : "Abonnement mensuel"}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span>Échéance : {formatDate(f.dueAt)}</span>
              </div>
              <button
                className={styles.boutonPayer}
                disabled={enCours === f.id}
                onClick={() => marquerPayeeLivreur(f.id)}
              >
                Marquer payée
              </button>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>Factures livreurs — historique</h2>
      {facturesLivreurs.filter((f) => f.status !== "PENDING").length === 0 ? (
        <p className={styles.messageVide}>Aucune autre facture livreur.</p>
      ) : (
        facturesLivreurs
          .filter((f) => f.status !== "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.driver.user.fullName}</span>
                <span>{f.kind === "opening_fee" ? "Frais d'ouverture" : "Abonnement mensuel"}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span className={styles.statutHistorique}>{LIBELLES_STATUT[f.status] ?? f.status}</span>
              </div>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>Factures Mon Comptable — en attente de paiement</h2>
      {facturesComptable.filter((f) => f.status === "PENDING").length === 0 ? (
        <p className={styles.messageVide}>Aucune facture Mon Comptable en attente.</p>
      ) : (
        facturesComptable
          .filter((f) => f.status === "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.subscription.user.fullName}</span>
                <span>{f.kind === "yearly" ? "Abonnement annuel" : "Abonnement mensuel"}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span>Échéance : {formatDate(f.dueAt)}</span>
              </div>
              <button
                className={styles.boutonPayer}
                disabled={enCours === f.id}
                onClick={() => marquerPayeeComptable(f.id)}
              >
                Marquer payée
              </button>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>Factures Mon Comptable — historique</h2>
      {facturesComptable.filter((f) => f.status !== "PENDING").length === 0 ? (
        <p className={styles.messageVide}>Aucune autre facture Mon Comptable.</p>
      ) : (
        facturesComptable
          .filter((f) => f.status !== "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.subscription.user.fullName}</span>
                <span>{f.kind === "yearly" ? "Abonnement annuel" : "Abonnement mensuel"}</span>
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
