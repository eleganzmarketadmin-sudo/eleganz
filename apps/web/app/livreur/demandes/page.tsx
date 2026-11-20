"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { StatusTag } from "../../components/StatusTag";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface DemandeAcces {
  id: string;
  status: "PENDING" | "ACTIVE" | "DECLINED" | "REVOKED";
  createdAt: string;
  respondedAt: string | null;
  shop: { id: string; name: string; invoiceAddress: string | null; invoicePhone: string | null };
}

const CLES_STATUT: Record<string, string> = {
  PENDING: "livDem_statutEnAttente",
  ACTIVE: "livDem_statutAcceptee",
  DECLINED: "livDem_statutRefusee",
  REVOKED: "livDem_statutRevoquee",
};

const HUMEUR_PAR_STATUT: Record<string, "paye" | "attente" | "alerte" | "neutre"> = {
  PENDING: "attente",
  ACTIVE: "paye",
  DECLINED: "alerte",
  REVOKED: "alerte",
};

function DemandesContent() {
  const { t } = useLocale();
  const [demandes, setDemandes] = useState<DemandeAcces[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<DemandeAcces[]>("/delivery/me/demandes")
      .then(setDemandes)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(recharger, []);

  async function repondre(accessId: string, accepte: boolean) {
    setEnCours(accessId);
    setErreur(null);
    try {
      await api.post(`/delivery/me/demandes/${accessId}/repondre`, { accepte });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("livDem_erreurReponse"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("livDem_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("livDem_titre")}</h1>
      <p className={styles.sousTitre}>{t("livDem_sousTitre")}</p>

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {demandes.length === 0 ? (
        <p className={styles.messageVide}>{t("livDem_aucuneDemande")}</p>
      ) : (
        demandes.map((d) => (
          <div className={styles.demande} key={d.id}>
            <div className={styles.entete}>
              <span>{d.shop.name}</span>
              <StatusTag
                label={t(CLES_STATUT[d.status] ?? "livDem_statutEnAttente")}
                humeur={HUMEUR_PAR_STATUT[d.status] ?? "neutre"}
              />
            </div>
            <div className={styles.corps}>
              {d.shop.invoiceAddress && <div>{d.shop.invoiceAddress}</div>}
              {d.shop.invoicePhone && <div>{t("livr_telAbrege")} {d.shop.invoicePhone}</div>}
            </div>
            {d.status === "PENDING" && (
              <div className={styles.actions}>
                <button
                  className={styles.boutonAccepter}
                  disabled={enCours === d.id}
                  onClick={() => repondre(d.id, true)}
                >
                  {enCours === d.id ? "…" : t("livDem_accepter")}
                </button>
                <button
                  className={styles.boutonRefuser}
                  disabled={enCours === d.id}
                  onClick={() => repondre(d.id, false)}
                >
                  {enCours === d.id ? "…" : t("livDem_refuser")}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default function DemandesPage() {
  return (
    <LivreurShell>
      <DemandesContent />
    </LivreurShell>
  );
}
