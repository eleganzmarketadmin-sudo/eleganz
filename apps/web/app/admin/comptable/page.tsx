"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface Overview {
  totalInscrits: number;
  activitesCreees: number;
  parStatut: Record<string, number>;
  parPlan: Record<string, number>;
  revenusEncaisses: number;
  facturesEnAttente: number;
  sansPlanChoisi: number;
}

const LABELS_STATUT: Record<string, string> = {
  FREE_PERIOD: "Période gratuite",
  PAYMENT_DUE: "Paiement attendu",
  ACTIVE: "Abonnement à jour",
  SUSPENDED: "Suspendus",
};

/**
 * Rubrique « Secourable » du Centre de pilotage (prompt du
 * 13 oct. 2026, §19) — données agrégées uniquement, jamais le détail
 * financier privé d'un utilisateur (ventes, dettes, loyers...) : le module
 * reste strictement confidentiel (prompt §18), seuls les comptages et
 * revenus du module sont visibles ici.
 */
function ComptableAdminContenu() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Overview>("/admin/comptable/overview")
      .then(setOverview)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function lancer(action: string, chemin: string) {
    setVerificationEnCours(action);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(`${action} : ${resultat.length} compte(s) concerné(s).`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setVerificationEnCours(null);
    }
  }

  if (chargement) return <p>Chargement…</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!overview) return null;

  return (
    <div>
      <h1 className={styles.titre}>Secourable</h1>
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.grille}>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Comptes activés</div>
          <div className={styles.carteValeur}>{overview.totalInscrits}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Activités créées</div>
          <div className={styles.carteValeur}>{overview.activitesCreees}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Revenus encaissés</div>
          <div className={styles.carteValeur}>{overview.revenusEncaisses.toFixed(2)} $</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Factures en attente</div>
          <div className={styles.carteValeur}>{overview.facturesEnAttente}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitre}>Répartition par statut de facturation</h2>
      <div className={styles.grille}>
        {Object.entries(LABELS_STATUT).map(([cle, label]) => (
          <div className={styles.carte} key={cle}>
            <div className={styles.carteLabel}>{label}</div>
            <div className={styles.carteValeur}>{overview.parStatut[cle] ?? 0}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitre}>Formules choisies (abonnés actifs)</h2>
      <div className={styles.grille}>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Mensuelle</div>
          <div className={styles.carteValeur}>{overview.parPlan["MONTHLY"] ?? 0}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>Annuelle</div>
          <div className={styles.carteValeur}>{overview.parPlan["YEARLY"] ?? 0}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitre}>Cycle de facturation (déclenchement manuel)</h2>
      <div className={styles.verifications}>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancer("Fin de période gratuite", "/admin/comptable/run-trial-check")}
        >
          Vérifier les gratuités échues
        </button>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancer("Facturation de renouvellement", "/admin/comptable/run-renewal-billing")}
        >
          Lancer la facturation de renouvellement
        </button>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancer("Suspension des impayés", "/admin/comptable/run-suspension-check")}
        >
          Suspendre les comptes en impayé
        </button>
      </div>
    </div>
  );
}

export default function AdminComptablePage() {
  return (
    <AdminShell>
      <ComptableAdminContenu />
    </AdminShell>
  );
}
