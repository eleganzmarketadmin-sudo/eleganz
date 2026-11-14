"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface Decision {
  id: string;
  shop: { id: string; name: string; slug: string };
  statut: "ACCORDE" | "REFUSE";
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  autoriserSuiviRemboursement: boolean;
  loanId: string | null;
  createdAt: string;
}

/** Historique de toutes les décisions prises par cette institution, toutes boutiques confondues (14 nov. 2026). */
function DecisionsContenu() {
  const { t } = useLocale();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Decision[]>("/institution-portal/decisions")
      .then(setDecisions)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
  }, []);

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_nav_decisions")}</h1>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {decisions === null && !erreur ? (
        <p>{t("commun_chargement")}</p>
      ) : decisions && decisions.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneDecision")}</p>
      ) : decisions ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("inst_colDate")}</th>
              <th>{t("inst_colBoutique")}</th>
              <th>{t("inst_colStatut")}</th>
              <th>{t("credit_labelMontant")}</th>
              <th>{t("credit_labelTaux")}</th>
              <th>{t("credit_labelDuree")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>
                  <Link href={`/institution/boutiques/${d.shop.id}`} style={{ textDecoration: "underline" }}>
                    {d.shop.name}
                  </Link>
                </td>
                <td>
                  <span className={`${styles.badge} ${d.statut === "ACCORDE" ? styles.badgeAccorde : styles.badgeRefuse}`}>
                    {t(d.statut === "ACCORDE" ? "inst_statutAccorde" : "inst_statutRefuse")}
                  </span>
                </td>
                <td className="chiffre">{d.montant.toLocaleString("fr-FR")}</td>
                <td className="chiffre">{d.tauxAnnuel.toLocaleString("fr-FR")} %</td>
                <td className="chiffre">{d.dureeMois}</td>
                <td>
                  {d.loanId ? (
                    <span className={`${styles.badge} ${styles.badgeDecaisse}`}>{t("inst_statutDecaisse")}</span>
                  ) : d.statut === "ACCORDE" ? (
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)" }}>{t("inst_enAttenteDecaissement")}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function DecisionsPage() {
  return (
    <InstitutionShell>
      <DecisionsContenu />
    </InstitutionShell>
  );
}
