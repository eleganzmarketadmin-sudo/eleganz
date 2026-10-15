"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
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

const CLES_STATUT: Record<string, string> = {
  FREE_PERIOD: "admcpt_catPeriodeGratuite",
  PAYMENT_DUE: "admcpt_catPaiementAttendu",
  ACTIVE: "admcpt_catAbonnementAJour",
  SUSPENDED: "admcpt_catSuspendus",
};

/**
 * Rubrique « Secourable » du Centre de pilotage (prompt du
 * 13 oct. 2026, §19) — données agrégées uniquement, jamais le détail
 * financier privé d'un utilisateur (ventes, dettes, loyers...) : le module
 * reste strictement confidentiel (prompt §18), seuls les comptages et
 * revenus du module sont visibles ici.
 */
function ComptableAdminContenu() {
  const { t } = useLocale();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Overview>("/admin/comptable/overview")
      .then(setOverview)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function lancer(action: string, chemin: string) {
    setVerificationEnCours(action);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ action: string }[]>(chemin, {});
      setMessage(
        t("admcpt_messageResultat")
          .replace("{{action}}", action)
          .replace("{{count}}", String(resultat.length)),
      );
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admcpt_actionImpossible"));
    } finally {
      setVerificationEnCours(null);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!overview) return null;

  return (
    <div>
      <h1 className={styles.titre}>{t("admcpt_titre")}</h1>
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.grille}>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_comptesActives")}</div>
          <div className={styles.carteValeur}>{overview.totalInscrits}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_activitesCreees")}</div>
          <div className={styles.carteValeur}>{overview.activitesCreees}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_revenusEncaisses")}</div>
          <div className={styles.carteValeur}>{overview.revenusEncaisses.toFixed(2)} $</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_facturesEnAttente")}</div>
          <div className={styles.carteValeur}>{overview.facturesEnAttente}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitre}>{t("admcpt_repartitionStatut")}</h2>
      <div className={styles.grille}>
        {Object.entries(CLES_STATUT).map(([cle, labelKey]) => (
          <div className={styles.carte} key={cle}>
            <div className={styles.carteLabel}>{t(labelKey)}</div>
            <div className={styles.carteValeur}>{overview.parStatut[cle] ?? 0}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitre}>{t("admcpt_formulesChoisies")}</h2>
      <div className={styles.grille}>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_mensuelle")}</div>
          <div className={styles.carteValeur}>{overview.parPlan["MONTHLY"] ?? 0}</div>
        </div>
        <div className={styles.carte}>
          <div className={styles.carteLabel}>{t("admcpt_annuelle")}</div>
          <div className={styles.carteValeur}>{overview.parPlan["YEARLY"] ?? 0}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitre}>{t("admcpt_cycleFacturation")}</h2>
      <div className={styles.verifications}>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancer(t("admcpt_actionFinPeriodeGratuite"), "/admin/comptable/run-trial-check")}
        >
          {t("admcpt_verifierGratuitesEchues")}
        </button>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() =>
            lancer(t("admcpt_actionFacturationRenouvellement"), "/admin/comptable/run-renewal-billing")
          }
        >
          {t("admcpt_lancerFacturationRenouvellement")}
        </button>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancer(t("admcpt_actionSuspensionImpayes"), "/admin/comptable/run-suspension-check")}
        >
          {t("admcpt_suspendreImpayes")}
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
