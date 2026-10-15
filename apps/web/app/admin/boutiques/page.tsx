"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Boutique {
  id: string;
  name: string;
  mode: string;
  status: string;
  isPubliclyListed: boolean;
  fiscalHomologationConfirmed: boolean;
  createdAt: string;
  owner: { fullName: string; email: string | null; phone: string | null };
  marketplaceBouquet: { id: string; name: string } | null;
  gestionBouquet: { id: string; name: string } | null;
  _count: { products: number; orders: number };
}

interface Plan {
  id: string;
  category: "MARKETPLACE" | "GESTION";
  name: string;
}

const CLES_STATUT: Record<string, string> = {
  PENDING_VALIDATION: "admbout_statutEnAttenteValidation",
  FREE_PERIOD: "admbout_statutPeriodeGratuite",
  ACTIVE: "admbout_statutActive",
  PAYMENT_DUE: "admbout_statutPaiementDu",
  SUSPENDED: "admbout_statutSuspendue",
  CLOSED: "admbout_statutFermee",
};

function BoutiquesContent() {
  const { t } = useLocale();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    Promise.all([api.get<Boutique[]>("/admin/shops"), api.get<Plan[]>("/admin/billing/plans")])
      .then(([shops, plansList]) => {
        setBoutiques(shops);
        setPlans(plansList);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setErreur(err instanceof ApiError ? err.message : t("admbout_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function basculerHomologation(shopId: string, confirmed: boolean) {
    setEnCours(shopId);
    setErreur(null);
    try {
      await api.patch(`/admin/shops/${shopId}/fiscal-homologation`, { confirmed });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admbout_changementHomologationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function changerBouquet(shopId: string, kind: "gestion" | "marketplace", planId: string) {
    setEnCours(shopId);
    setErreur(null);
    try {
      await api.patch(`/admin/shops/${shopId}/plan`, { kind, planId: planId || null });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admbout_changementBouquetImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("admbout_chargementBoutiques")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admbout_titre")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {boutiques.length === 0 ? (
        <p className={styles.messageVide}>{t("admbout_aucuneBoutique")}</p>
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
                    {t(CLES_STATUT[b.status] ?? "") || b.status}
                  </span>
                </div>
                <span className={styles.date}>{t("admbout_inscriteLe")} {formatDate(b.createdAt)}</span>
              </div>
              <div className={styles.corps}>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_proprietaire")}</span>
                  <span>{b.owner.fullName} — {b.owner.email ?? b.owner.phone}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_mode")}</span>
                  <span>{b.mode}{b.isPubliclyListed ? ` · ${t("admbout_publieeMarketplace")}` : ""}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_bouquetGestion")}</span>
                  <select
                    value={b.gestionBouquet?.id ?? ""}
                    disabled={enCours === b.id}
                    onChange={(e) => changerBouquet(b.id, "gestion", e.target.value)}
                  >
                    <option value="">{t("admbout_aucun")}</option>
                    {plans
                      .filter((p) => p.category === "GESTION")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_bouquetMarketplace")}</span>
                  <select
                    value={b.marketplaceBouquet?.id ?? ""}
                    disabled={enCours === b.id}
                    onChange={(e) => changerBouquet(b.id, "marketplace", e.target.value)}
                  >
                    <option value="">{t("admbout_aucun")}</option>
                    {plans
                      .filter((p) => p.category === "MARKETPLACE")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_catalogue")}</span>
                  <span>{b._count.products} {t("admbout_articles")} · {b._count.orders} {t("admbout_commandesRecues")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admbout_factureFiscaleHomologuee")}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={b.fiscalHomologationConfirmed}
                      disabled={enCours === b.id}
                      onChange={(e) => basculerHomologation(b.id, e.target.checked)}
                    />
                    {b.fiscalHomologationConfirmed
                      ? t("admbout_homologationConfirmee")
                      : t("admbout_homologationNonConfirmee")}
                  </label>
                </div>
              </div>
              <div className={styles.actions}>
                {suspendue ? (
                  <button
                    className={styles.boutonReactiver}
                    disabled={enCours === b.id}
                    onClick={() => basculer(b.id, "reactivate")}
                  >
                    {t("admbout_reactiver")}
                  </button>
                ) : (
                  <button
                    className={styles.boutonSuspendre}
                    disabled={enCours === b.id}
                    onClick={() => basculer(b.id, "suspend")}
                  >
                    {t("admbout_suspendre")}
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
