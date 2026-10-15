"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
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

const CLES_STATUT: Record<string, string> = {
  PENDING: "admfact_statutEnAttente",
  PAID: "admfact_statutPayee",
  OVERDUE: "admfact_statutEnRetard",
  WAIVED: "admfact_statutDispensee",
};

function FacturesContent() {
  const { t } = useLocale();
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function lancerEcheancier() {
    setVerificationEnCours("echeancier");
    setErreur(null);
    setMessage(null);
    try {
      const resultats = await api.post<{ dettes: number; loyers: number; versements: number; achatsFournisseur: number }>(
        "/admin/echeancier/run",
      );
      const total = resultats.dettes + resultats.loyers + resultats.versements + resultats.achatsFournisseur;
      setMessage(
        total === 0
          ? t("admfact_messageAucuneEcheance")
          : `${total}${t("admfact_relancesEnvoyeesSuffixDettesCreances")} ${resultats.dettes}${t("admfact_virgLoyers")} ${resultats.loyers}${t("admfact_virgVersements")} ${resultats.versements}${t("admfact_virgFournisseurs")} ${resultats.achatsFournisseur}).`,
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admfact_verificationImpossible"));
    } finally {
      setVerificationEnCours(null);
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
          ? t("admfact_messageAucuneBoutiqueConcernee")
          : `${resultats.length} ${t("admfact_messageBoutiquesMisesAJour")}`,
      );
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admfact_verificationImpossible"));
    } finally {
      setVerificationEnCours(null);
    }
  }

  if (chargement) return <p>{t("admfact_chargementFactures")}</p>;

  const enAttente = factures.filter((f) => f.status === "PENDING");
  const autres = factures.filter((f) => f.status !== "PENDING");

  return (
    <div>
      <h1 className={styles.titre}>{t("admfact_titre")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifFinPeriodeGratuiteLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifFinPeriodeGratuiteDescription")}</p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-trial-check")}
        >
          {t("admfact_verifierMaintenant")}
        </button>
      </div>
      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifRetardsPaiementLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifRetardsPaiementDescription")}</p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-suspension-check")}
        >
          {t("admfact_verifierMaintenant")}
        </button>
      </div>
      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifEcheancierLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifEcheancierDescription")}</p>
        </div>
        <button className={styles.boutonVerif} disabled={verificationEnCours !== null} onClick={lancerEcheancier}>
          {t("admfact_verifierMaintenant")}
        </button>
      </div>

      <h2 className={styles.sectionTitre}>{t("admfact_enAttentePaiement")}</h2>
      {enAttente.length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneFactureEnAttente")}</p>
      ) : (
        enAttente.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{f.shop.name}</span>
              <span>{f.kind}</span>
              <span>{formatMoney(Number(f.amount))}</span>
              <span>{t("crd_colEcheance")} : {formatDate(f.dueAt)}</span>
            </div>
            <button
              className={styles.boutonPayer}
              disabled={enCours === f.id}
              onClick={() => marquerPayee(f.id)}
            >
              {t("admfact_marquerPayee")}
            </button>
          </div>
        ))
      )}

      <h2 className={styles.sectionTitre}>{t("admfact_historique")}</h2>
      {autres.length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneAutreFacture")}</p>
      ) : (
        autres.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{f.shop.name}</span>
              <span>{f.kind}</span>
              <span>{formatMoney(Number(f.amount))}</span>
              <span className={styles.statutHistorique}>{CLES_STATUT[f.status] ? t(CLES_STATUT[f.status]) : f.status}</span>
            </div>
          </div>
        ))
      )}

      <h2 className={styles.sectionTitre}>
        {t("admfact_facturesLivreurs")} — {t("admfact_enAttentePaiement")}
      </h2>
      {facturesLivreurs.filter((f) => f.status === "PENDING").length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneFactureLivreurEnAttente")}</p>
      ) : (
        facturesLivreurs
          .filter((f) => f.status === "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.driver.user.fullName}</span>
                <span>{f.kind === "opening_fee" ? t("admfact_fraisOuverture") : t("admfact_abonnementMensuel")}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span>{t("crd_colEcheance")} : {formatDate(f.dueAt)}</span>
              </div>
              <button
                className={styles.boutonPayer}
                disabled={enCours === f.id}
                onClick={() => marquerPayeeLivreur(f.id)}
              >
                {t("admfact_marquerPayee")}
              </button>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>
        {t("admfact_facturesLivreurs")} — {t("admfact_historique")}
      </h2>
      {facturesLivreurs.filter((f) => f.status !== "PENDING").length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneAutreFactureLivreur")}</p>
      ) : (
        facturesLivreurs
          .filter((f) => f.status !== "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.driver.user.fullName}</span>
                <span>{f.kind === "opening_fee" ? t("admfact_fraisOuverture") : t("admfact_abonnementMensuel")}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span className={styles.statutHistorique}>{CLES_STATUT[f.status] ? t(CLES_STATUT[f.status]) : f.status}</span>
              </div>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>
        {t("admfact_facturesSecourable")} — {t("admfact_enAttentePaiement")}
      </h2>
      {facturesComptable.filter((f) => f.status === "PENDING").length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneFactureSecourableEnAttente")}</p>
      ) : (
        facturesComptable
          .filter((f) => f.status === "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.subscription.user.fullName}</span>
                <span>{f.kind === "yearly" ? t("admfact_abonnementAnnuel") : t("admfact_abonnementMensuel")}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span>{t("crd_colEcheance")} : {formatDate(f.dueAt)}</span>
              </div>
              <button
                className={styles.boutonPayer}
                disabled={enCours === f.id}
                onClick={() => marquerPayeeComptable(f.id)}
              >
                {t("admfact_marquerPayee")}
              </button>
            </div>
          ))
      )}

      <h2 className={styles.sectionTitre}>
        {t("admfact_facturesSecourable")} — {t("admfact_historique")}
      </h2>
      {facturesComptable.filter((f) => f.status !== "PENDING").length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneAutreFactureSecourable")}</p>
      ) : (
        facturesComptable
          .filter((f) => f.status !== "PENDING")
          .map((f) => (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.subscription.user.fullName}</span>
                <span>{f.kind === "yearly" ? t("admfact_abonnementAnnuel") : t("admfact_abonnementMensuel")}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span className={styles.statutHistorique}>{CLES_STATUT[f.status] ? t(CLES_STATUT[f.status]) : f.status}</span>
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
