"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Litige {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  shopOrder: { id: string; shop: { name: string } };
}

function LitigesContent() {
  const { t } = useLocale();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  // Correctif audit du 16 oct. 2026 : resolve() exige désormais une
  // décision explicite (rembourser ou rejeter), sans quoi la commande
  // restait bloquée sur DISPUTED même une fois le litige "tranché".
  const [issues, setIssues] = useState<Record<string, "REFUND" | "REJECTED">>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<Litige[]>("/admin/disputes")
      .then(setLitiges)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function resoudre(disputeId: string) {
    const resolution = resolutions[disputeId];
    const outcome = issues[disputeId];
    if (!resolution || !outcome) return;
    setEnCours(disputeId);
    try {
      await api.patch(`/admin/disputes/${disputeId}/resolve`, { outcome, resolution });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admlitiges_resolutionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admlitiges_titre")}</h1>
      {erreur && <p>{erreur}</p>}

      {litiges.length === 0 ? (
        <p className={styles.messageVide}>{t("admlitiges_aucunLitigeOuvert")}</p>
      ) : (
        litiges.map((l) => (
          <div className={styles.litige} key={l.id}>
            <div className={styles.entete}>
              <span>{l.shopOrder.shop.name}</span>
              <span>{formatDate(l.createdAt)}</span>
            </div>
            <p className={styles.motif}>{l.reason}</p>
            <div className={styles.resolution} style={{ flexWrap: "wrap", gap: "8px" }}>
              <select
                value={issues[l.id] ?? ""}
                onChange={(e) => setIssues((prev) => ({ ...prev, [l.id]: e.target.value as "REFUND" | "REJECTED" }))}
              >
                <option value="">{t("admlitiges_choisirDecision")}</option>
                <option value="REFUND">{t("admlitiges_decisionRembourser")}</option>
                <option value="REJECTED">{t("admlitiges_decisionRejeter")}</option>
              </select>
              <input
                placeholder={t("admlitiges_placeholderDecision")}
                value={resolutions[l.id] ?? ""}
                onChange={(e) => setResolutions((prev) => ({ ...prev, [l.id]: e.target.value }))}
              />
              <button
                className={styles.bouton}
                disabled={enCours === l.id || !resolutions[l.id] || !issues[l.id]}
                onClick={() => resoudre(l.id)}
              >
                {t("admlitiges_resoudre")}
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
