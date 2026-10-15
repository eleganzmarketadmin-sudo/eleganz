"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { StatusTag } from "../../components/StatusTag";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Litige {
  id: string;
  reason: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  shopOrder: { id: string; lines: { id: string }[] };
}

const CLES_LABELS: Record<string, string> = {
  OPEN: "lit_statutOuvert",
  UNDER_REVIEW: "lit_statutEnExamen",
  RESOLVED: "lit_statutResolu",
};

function LitigesContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    api
      .get<Litige[]>(`/shops/${currentShop.id}/disputes`)
      .then(setLitiges)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cmd_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [currentShop]);

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_litiges")}</h1>
      {erreur && <p>{erreur}</p>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : litiges.length === 0 ? (
        <p className={styles.messageVide}>{t("lit_aucunLitige")}</p>
      ) : (
        litiges.map((l) => (
          <div className={styles.litige} key={l.id}>
            <div className={styles.entete}>
              <span>
                {t("lit_commandeNum").replace("{{id}}", l.shopOrder.id.slice(0, 8))} — {formatDate(l.createdAt)}
              </span>
              <StatusTag
                label={CLES_LABELS[l.status] ? t(CLES_LABELS[l.status]) : l.status}
                humeur={l.status === "RESOLVED" ? "paye" : "alerte"}
              />
            </div>
            <p className={styles.motif}>{l.reason}</p>
            {l.resolution && (
              <div className={styles.resolution}>
                {t("lit_decision")} {l.resolution}
              </div>
            )}
          </div>
        ))
      )}
      <p style={{ color: "#555", fontSize: "0.875rem", marginTop: "16px" }}>{t("lit_noteResponsabilite")}</p>
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
