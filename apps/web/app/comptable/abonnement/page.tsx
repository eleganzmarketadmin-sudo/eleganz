"use client";

import { useEffect, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Bouquet {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxActivities: number | null;
  featuresJson: Record<string, unknown>;
}

interface Subscription {
  billingStatus: "FREE_PERIOD" | "PAYMENT_DUE" | "ACTIVE" | "SUSPENDED";
  freeTrialStartedAt: string;
  activatedAt: string;
  plan: "MONTHLY" | "YEARLY" | null;
  renewsAt: string | null;
  bouquetId: string | null;
  bouquet: Bouquet | null;
}

interface Tarification {
  comptableMonthlyFee: string;
  comptableYearlyFee: string;
  comptableFreeMonths: number;
}

const CLES_STATUT: Record<string, string> = {
  FREE_PERIOD: "abo_statutPeriodeGratuite",
  PAYMENT_DUE: "abo_statutPaiementAttendu",
  ACTIVE: "abo_statutAJour",
  SUSPENDED: "abo_statutSuspendu",
};

// Les 4 fonctionnalités de bouquet Secourable (voir
// comptable-plans.service.ts) — mêmes clés de traduction que l'écran
// /admin/tarifs (section Mon assistant), réutilisées ici pour que l'abonné
// voie exactement ce que chaque bouquet inclut.
const CLES_FONCTIONNALITES_COMPTABLE: { cle: string; cleTrad: string }[] = [
  { cle: "historiqueIllimite", cleTrad: "admtarifs_cpt_historiqueIllimite" },
  { cle: "comparaisonPeriodes", cleTrad: "admtarifs_cpt_comparaisonPeriodes" },
  { cle: "rappelsAgenda", cleTrad: "admtarifs_cpt_rappelsAgenda" },
  { cle: "exportDossierFinancement", cleTrad: "admtarifs_cpt_exportDossierFinancement" },
];

// Facturation ELEGANZ côté Secourable (16 nov. 2026, chantier relances/
// recouvrement) — même principe que la section homonyme côté boutique et
// côté livreur : liste des factures via GET /comptable/subscription/invoices
// (déjà exposée, jamais consommée côté front avant ce chantier), dépôt de
// preuve de paiement en 3 étapes, historique avec pénalité figée.
interface FactureEleganz {
  id: string;
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  reminderStage: number;
  penaltyDays: number | null;
  penaltyAmount: string | null;
}

const CLES_PALIER_FACTURATION: Record<number, string> = {
  1: "admfact_palier1",
  2: "admfact_palier2",
  3: "admfact_palier3",
  4: "admfact_palier4",
  5: "admfact_palier5",
};

function FacturationElegansSection({ billingStatus }: { billingStatus: string }) {
  const { t } = useLocale();
  const [factures, setFactures] = useState<FactureEleganz[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [preuveOuverte, setPreuveOuverte] = useState<string | null>(null);
  const [noteParFacture, setNoteParFacture] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function recharger() {
    api
      .get<FactureEleganz[]>("/comptable/subscription/invoices")
      .then(setFactures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("abonnement_erreurChargement")));
  }

  useEffect(recharger, []);

  async function deposerPreuve(factureId: string, fichier: File) {
    setEnCours(factureId);
    setErreur(null);
    setConfirmation(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/comptable/subscription/invoices/${factureId}/proof-of-payment/upload-url`,
        { contentType: fichier.type },
      );
      const reponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!reponse.ok) throw new Error(t("factElg_erreurEnvoiStockage"));
      await api.post(`/comptable/subscription/invoices/${factureId}/proof-of-payment`, {
        fileUrl: publicUrl,
        note: noteParFacture[factureId] || undefined,
      });
      setConfirmation(t("factElg_preuveDeposee"));
      setPreuveOuverte(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("factElg_erreurEnvoiPreuve"));
    } finally {
      setEnCours(null);
    }
  }

  if (factures === null && !erreur) return <p>{t("abonnement_chargement")}</p>;

  const enAttente = (factures ?? []).filter((f) => f.status === "PENDING");
  const historique = (factures ?? []).filter((f) => f.status !== "PENDING").slice(0, 10);

  return (
    <div style={{ marginTop: "var(--espace-5)" }}>
      <h2 style={{ marginBottom: "16px" }}>{t("factElg_titre")}</h2>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {confirmation && <p>{confirmation}</p>}
      {billingStatus === "SUSPENDED" && <p className={styles.erreur}>{t("factElg_noteSuspendueComptable")}</p>}

      {enAttente.length === 0 ? (
        <p>{t("factElg_aucuneFactureEnAttente")}</p>
      ) : (
        enAttente.map((f) => (
          <div key={f.id} className={styles.ligne} style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--espace-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--espace-3)", flexWrap: "wrap" }}>
              <span>
                {f.amount} $ — {t("crd_colEcheance")} : {new Date(f.dueAt).toLocaleDateString()}
              </span>
              {f.reminderStage > 0 && CLES_PALIER_FACTURATION[f.reminderStage] && <span>{t(CLES_PALIER_FACTURATION[f.reminderStage])}</span>}
            </div>
            {preuveOuverte === f.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--espace-2)" }}>
                <input
                  type="text"
                  placeholder={t("factElg_notePlaceholder")}
                  value={noteParFacture[f.id] ?? ""}
                  onChange={(e) => setNoteParFacture((n) => ({ ...n, [f.id]: e.target.value }))}
                />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    if (fichier) deposerPreuve(f.id, fichier);
                  }}
                  disabled={enCours === f.id}
                />
              </div>
            ) : (
              <button className={styles.bouton} style={{ width: "auto" }} onClick={() => setPreuveOuverte(f.id)}>
                {t("factElg_deposerPreuve")}
              </button>
            )}
          </div>
        ))
      )}

      <h3 style={{ marginTop: "var(--espace-4)", marginBottom: "var(--espace-2)" }}>{t("factElg_historique")}</h3>
      {historique.length === 0 ? (
        <p>{t("factElg_aucunHistorique")}</p>
      ) : (
        historique.map((f) => (
          <div key={f.id} className={styles.ligne}>
            <span>
              {f.amount} $ — {f.paidAt ? new Date(f.paidAt).toLocaleDateString() : ""}
            </span>
            <span>
              {t("admfact_statutPayee")}
              {f.penaltyAmount && Number(f.penaltyAmount) > 0 ? ` — ${t("admfact_penalite")} : ${f.penaltyAmount} $` : ""}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function AbonnementContenu() {
  const { t } = useLocale();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tarification, setTarification] = useState<Tarification | null>(null);
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bouquetEnCours, setBouquetEnCours] = useState<string | null>(null);

  function recharger() {
    Promise.all([
      api.get<Subscription>("/comptable/subscription"),
      api.get<Tarification>("/platform-settings/comptable-pricing", false),
      api.get<Bouquet[]>("/comptable/plans", false),
    ])
      .then(([s, tp, b]) => {
        setSubscription(s);
        setTarification(tp);
        setBouquets(b);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function choisir(plan: "MONTHLY" | "YEARLY") {
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/subscription/plan", { plan });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("abo_choixImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  async function choisirBouquet(bouquetId: string) {
    setBouquetEnCours(bouquetId);
    setErreur(null);
    try {
      await api.post("/comptable/subscription/bouquet", { bouquetId });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("abo_choixImpossible"));
    } finally {
      setBouquetEnCours(null);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (!subscription || !tarification) return <p className={styles.erreur}>{erreur}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_abonnement")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.carte}>
        <div className={styles.ligne}>
          <span>{t("abo_statut")}</span>
          <strong>{t(CLES_STATUT[subscription.billingStatus])}</strong>
        </div>
        <div className={styles.ligne}>
          <span>{t("abo_debutPeriodeGratuite")}</span>
          <span>{formatDate(subscription.freeTrialStartedAt)}</span>
        </div>
        <div className={styles.ligne}>
          <span>{t("abo_dureeGratuite")}</span>
          <span>{tarification.comptableFreeMonths} {t("imm_mois")}</span>
        </div>
        {subscription.renewsAt && (
          <div className={styles.ligne}>
            <span>{t("abo_prochainRenouvellement")}</span>
            <span>{formatDate(subscription.renewsAt)}</span>
          </div>
        )}
        <div className={styles.ligne}>
          <span>{t("abo_formuleChoisie")}</span>
          <span>{subscription.plan === "YEARLY" ? t("abo_annuelle") : subscription.plan === "MONTHLY" ? t("abo_mensuelle") : t("abo_nonChoisie")}</span>
        </div>
      </div>

      <h2 style={{ marginBottom: "16px" }}>{t("abo_choisirBouquet")}</h2>
      <div className={styles.bouquets}>
        {bouquets.map((b) => {
          const actif = b.id === subscription.bouquetId;
          const fonctionnalites = CLES_FONCTIONNALITES_COMPTABLE.filter(({ cle }) => b.featuresJson[cle] === true);
          return (
            <button
              key={b.id}
              type="button"
              className={`${styles.carteBouquet} ${actif ? styles.carteBouquetActive : ""}`}
              disabled={bouquetEnCours !== null}
              onClick={() => !actif && choisirBouquet(b.id)}
            >
              <strong>{b.name}</strong>
              <p className={styles.prixBouquet}>
                {b.monthlyPrice} $ {t("abonnement_parMois")}
              </p>
              {b.maxActivities != null && (
                <p className={styles.note}>
                  {t("abo_activitesMax")} : {b.maxActivities}
                </p>
              )}
              {fonctionnalites.length > 0 && (
                <ul className={styles.listeFonctionnalites}>
                  {fonctionnalites.map(({ cleTrad }) => (
                    <li key={cleTrad}>{t(cleTrad)}</li>
                  ))}
                </ul>
              )}
              {actif && <span className={styles.badgeChoisi}>{t("abonnement_bouquetActuelBadge")}</span>}
            </button>
          );
        })}
      </div>

      <h2 style={{ marginBottom: "16px" }}>{t("abo_choisirFormule")}</h2>
      <div className={styles.plans}>
        <div className={`${styles.plan} ${subscription.plan === "MONTHLY" ? styles.planChoisi : ""}`}>
          <div>{t("abo_mensuelle")}</div>
          <div className={styles.planPrix}>{tarification.comptableMonthlyFee} $ / {t("abo_mois")}</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("MONTHLY")}>
            {subscription.plan === "MONTHLY" ? t("abo_formuleActuelle") : t("abo_choisir")}
          </button>
        </div>
        <div className={`${styles.plan} ${subscription.plan === "YEARLY" ? styles.planChoisi : ""}`}>
          <div>{t("abo_annuelle")}</div>
          <div className={styles.planPrix}>{tarification.comptableYearlyFee} $ / {t("abo_an")}</div>
          <button className={styles.bouton} disabled={enCours} onClick={() => choisir("YEARLY")}>
            {subscription.plan === "YEARLY" ? t("abo_formuleActuelle") : t("abo_choisir")}
          </button>
        </div>
      </div>

      <p style={{ marginTop: "24px", color: "var(--color-texte-muted)", fontSize: "0.875rem" }}>
        {t("abo_noteDonneesConsultables")}
      </p>

      <FacturationElegansSection billingStatus={subscription.billingStatus} />
    </div>
  );
}

export default function ComptableAbonnementPage() {
  return (
    <ComptableShell>
      <AbonnementContenu />
    </ComptableShell>
  );
}
